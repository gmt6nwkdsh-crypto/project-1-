// Accounts: GET = who's signed in; POST {action: signup | login | logout | delete}.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { query } from '../lib/db.js';
import {
  send, fail, readJson, currentUser, setSessionCookie, clearSessionCookie,
  parseCookies, COOKIE, sha256, clientIp, sameOrigin, handleError
} from '../lib/http.js';

const scrypt = promisify(crypto.scrypt);
const LONG = 180 * 24 * 3600; // "save my login": 180 days
const SHORT = 24 * 3600;      // otherwise the session ends after a day (cookie ends with the browser)
const USERNAME = /^[a-z0-9_.-]{3,24}$/;

async function hashPw(pw, saltHex) {
  const buf = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return buf.toString('hex');
}

async function startSession(req, res, userId, remember) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ttl = remember ? LONG : SHORT;
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [sha256(token), userId, ttl]
  );
  setSessionCookie(req, res, token, remember ? LONG : 0);
  // tidy up old sessions now and then
  if (Math.random() < 0.05) query(`DELETE FROM sessions WHERE expires_at < now()`).catch(() => {});
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const u = await currentUser(req);
      return send(res, 200, { user: u ? { username: u.username, name: u.display_name } : null });
    }
    if (req.method !== 'POST') return fail(res, 405, 'method');
    if (!sameOrigin(req)) return fail(res, 403, 'origin');

    const body = await readJson(req, 64 * 1024);
    const action = body.action;

    if (action === 'logout') {
      const token = parseCookies(req)[COOKIE];
      if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
      clearSessionCookie(req, res);
      return send(res, 200, { ok: true });
    }

    const name = String(body.username || '').trim();
    const username = name.toLowerCase();
    const pw = String(body.password || '');
    const remember = body.remember !== false;

    if (action === 'signup') {
      if (!USERNAME.test(username)) return fail(res, 400, 'bad_username', 'Usernames are 3–24 characters: letters, numbers, dots, dashes or underscores.');
      if (pw.length < 8) return fail(res, 400, 'weak_password', 'Use a password with at least 8 characters.');
      if (pw.length > 200) return fail(res, 400, 'weak_password', 'That password is too long.');
      const ipH = sha256('ip:' + clientIp(req));
      const recent = await query(`SELECT count(*)::int AS n FROM users WHERE created_ip = $1 AND created_at > now() - interval '1 hour'`, [ipH]);
      if (recent.rows[0].n >= 5) return fail(res, 429, 'slow_down', 'Too many new accounts from this network. Try again in an hour.');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await hashPw(pw, salt);
      let r;
      try {
        r = await query(
          `INSERT INTO users (username, display_name, pw_hash, pw_salt, created_ip) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [username, name.slice(0, 24), hash, salt, ipH]
        );
      } catch (e) {
        if (e && e.code === '23505') return fail(res, 409, 'taken', 'That username is taken. Pick another, or sign in if it’s yours.');
        throw e;
      }
      await startSession(req, res, r.rows[0].id, remember);
      return send(res, 200, { user: { username, name: name.slice(0, 24) } });
    }

    if (action === 'login') {
      if (!username || !pw) return fail(res, 400, 'missing', 'Enter your username and password.');
      const r = await query(`SELECT id, display_name, pw_hash, pw_salt, failed_logins, locked_until FROM users WHERE username = $1`, [username]);
      const u = r.rows[0];
      const wrong = () => fail(res, 401, 'wrong', 'That username and password don’t match.');
      if (!u) { await hashPw(pw, '00'.repeat(16)); return wrong(); } // same timing either way
      if (u.locked_until && new Date(u.locked_until) > new Date()) {
        return fail(res, 429, 'locked', 'Too many wrong passwords. Wait 15 minutes and try again.');
      }
      const hash = await hashPw(pw, u.pw_salt);
      const ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pw_hash, 'hex'));
      if (!ok) {
        const n = u.failed_logins + 1;
        const lock = n >= 8;
        await query(
          lock
            ? `UPDATE users SET failed_logins = 0, locked_until = now() + interval '15 minutes' WHERE id = $1`
            : `UPDATE users SET failed_logins = $2, locked_until = NULL WHERE id = $1`,
          lock ? [u.id] : [u.id, n]
        );
        return wrong();
      }
      await query(`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [u.id]);
      await startSession(req, res, u.id, remember);
      return send(res, 200, { user: { username, name: u.display_name } });
    }

    if (action === 'change_password') {
      const me = await currentUser(req);
      if (!me) return fail(res, 401, 'signed_out', 'Sign in again.');
      const r = await query(`SELECT pw_hash, pw_salt FROM users WHERE id = $1`, [me.id]);
      const cur = await hashPw(String(body.current || ''), r.rows[0].pw_salt);
      if (!crypto.timingSafeEqual(Buffer.from(cur, 'hex'), Buffer.from(r.rows[0].pw_hash, 'hex'))) return fail(res, 401, 'wrong', 'Your current password isn’t right.');
      if (pw.length < 8) return fail(res, 400, 'weak_password', 'Use a new password with at least 8 characters.');
      const salt = crypto.randomBytes(16).toString('hex');
      await query(`UPDATE users SET pw_hash = $2, pw_salt = $3 WHERE id = $1`, [me.id, await hashPw(pw, salt), salt]);
      const token = parseCookies(req)[COOKIE];
      await query(`DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2`, [me.id, sha256(token || '')]);
      return send(res, 200, { ok: true });
    }

    if (action === 'delete') {
      const me = await currentUser(req);
      if (!me) return fail(res, 401, 'signed_out', 'Sign in again.');
      const r = await query(`SELECT pw_hash, pw_salt FROM users WHERE id = $1`, [me.id]);
      const h = await hashPw(pw, r.rows[0].pw_salt);
      if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(r.rows[0].pw_hash, 'hex'))) return fail(res, 401, 'wrong', 'That password isn’t right.');
      await query(`DELETE FROM users WHERE id = $1`, [me.id]);
      clearSessionCookie(req, res);
      return send(res, 200, { ok: true });
    }

    return fail(res, 400, 'action');
  } catch (e) {
    handleError(res, e);
  }
}
