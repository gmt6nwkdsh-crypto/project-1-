// Small helpers shared by the API routes: JSON in/out, cookies, and the signed-in user.
import crypto from 'node:crypto';
import { query } from './db.js';

export const COOKIE = 'am_session';

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function fail(res, status, code, message) {
  send(res, status, { error: { code, message: message || code } });
}

export async function readJson(req, limit = 6 * 1024 * 1024) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) { const e = new Error('too_large'); e.code = 'too_large'; throw e; }
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const isLocal = req => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');

export function setSessionCookie(req, res, token, maxAgeSec) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (!isLocal(req)) parts.push('Secure');
  if (maxAgeSec) parts.push(`Max-Age=${maxAgeSec}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req, res) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (!isLocal(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

export function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0] : req.socket?.remoteAddress || '').trim();
}

// Returns { id, username, display_name } or null.
export async function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token || token.length < 20) return null;
  const r = await query(
    `SELECT u.id, u.username, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]
  );
  return r.rows[0] || null;
}

// Rejects cross-site form posts: writes must come from this site's own page.
export function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

export function handleError(res, e) {
  if (e && e.code === 'no_database') return fail(res, 503, 'no_database', e.message);
  if (e && e.code === 'too_large') return fail(res, 413, 'too_large', 'That was too large to upload.');
  console.error(e);
  fail(res, 500, 'server', 'Something went wrong on the server. Try again.');
}
