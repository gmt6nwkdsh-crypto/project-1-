// Notifications: a daily quote each morning, plus friend nudges (sent from api/friends.js).
// GET  /api/push            -> { key } public key the browser needs to subscribe
// GET  /api/push?cron=1     -> sends today's quote to everyone subscribed (Vercel Cron calls /api/cron-quote)
// POST { action: 'subscribe', sub, tz } | { action: 'unsubscribe', endpoint } | { action: 'test' } | { action: 'status', endpoint }
import { query } from '../lib/db.js';
import { send, fail, readJson, currentUser, sameOrigin, handleError } from '../lib/http.js';
import { vapidKeys, sendPush } from '../lib/push.js';
import { quoteFor } from '../lib/quotes.js';

export const config = { maxDuration: 60 };

const site = () => process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'https://project-1-flax-six-30.vercel.app');
const validTz = tz => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
export const dayIn = (tz, at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: validTz(tz) ? tz : 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

export function quotePayload(day) {
  const q = quoteFor(day);
  return { title: 'Your daily quote', body: `“${q.text}” — ${q.who}${q.when ? ', ' + q.when : ''}`, tag: 'quote-' + day, url: '/' };
}

// Sends to every subscription of one person. Returns how many got through.
export async function pushToUser(userId, payload) {
  const r = await query(`SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = $1`, [userId]);
  let ok = 0;
  for (const s of r.rows) {
    const out = await sendPush(s, payload, site());
    if (out === 'ok') ok++;
    if (out === 'gone') await query(`DELETE FROM push_subs WHERE endpoint = $1`, [s.endpoint]);
  }
  return ok;
}

export async function runDaily(res) {
  const r = await query(`SELECT endpoint, user_id, p256dh, auth, tz, last_quote::text AS last_quote FROM push_subs`);
  let sent = 0, gone = 0, skipped = 0;
  const todo = r.rows.filter(s => {
    const day = dayIn(s.tz);
    const last = s.last_quote || null;
    if (last && last >= day) { skipped++; return false; } // already sent today, so a repeat run does nothing
    s.day = day; return true;
  });
  for (let i = 0; i < todo.length; i += 10) {
    await Promise.all(todo.slice(i, i + 10).map(async s => {
      const out = await sendPush(s, quotePayload(s.day), site());
      if (out === 'gone') { gone++; await query(`DELETE FROM push_subs WHERE endpoint = $1`, [s.endpoint]); }
      else if (out === 'ok') { sent++; await query(`UPDATE push_subs SET last_quote = $2 WHERE endpoint = $1`, [s.endpoint, s.day]); }
    }));
  }
  return send(res, 200, { sent, gone, skipped });
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET') {
      if (url.searchParams.get('cron')) {
        const secret = process.env.CRON_SECRET;
        if (secret && req.headers.authorization !== 'Bearer ' + secret) return fail(res, 401, 'cron');
        return runDaily(res);
      }
      const k = await vapidKeys();
      const tz = url.searchParams.get('tz');
      return send(res, 200, { key: k.pub, quote: quoteFor(dayIn(tz)) });
    }
    if (req.method !== 'POST') return fail(res, 405, 'method');
    if (!sameOrigin(req)) return fail(res, 403, 'origin');
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'signed_out', 'You’ve been signed out. Sign in again.');
    const body = await readJson(req, 16 * 1024);
    const tz = validTz(body.tz) ? String(body.tz) : null;
    if (tz) await query(`UPDATE users SET tz = $2 WHERE id = $1`, [me.id, tz]);

    if (body.action === 'subscribe') {
      const s = body.sub || {};
      const ep = String(s.endpoint || ''), p = String((s.keys && s.keys.p256dh) || ''), a = String((s.keys && s.keys.auth) || '');
      if (!/^https:\/\//.test(ep) || ep.length > 1000 || !/^[A-Za-z0-9_-]{80,100}$/.test(p) || !/^[A-Za-z0-9_-]{16,32}$/.test(a)) return fail(res, 400, 'bad_sub', 'This browser sent an unusable subscription. Try again.');
      // a new subscription shouldn't get a second quote on a day the person already got one
      const had = await query(`SELECT max(last_quote)::text AS d FROM push_subs WHERE user_id = $1`, [me.id]);
      await query(
        `INSERT INTO push_subs (endpoint, user_id, p256dh, auth, tz, last_quote) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, tz = EXCLUDED.tz`,
        [ep, me.id, p, a, tz, had.rows[0] && had.rows[0].d ? had.rows[0].d : null]
      );
      return send(res, 200, { ok: true });
    }
    if (body.action === 'unsubscribe') {
      await query(`DELETE FROM push_subs WHERE user_id = $1 AND endpoint = $2`, [me.id, String(body.endpoint || '')]);
      return send(res, 200, { ok: true });
    }
    if (body.action === 'status') {
      const r = await query(`SELECT 1 FROM push_subs WHERE user_id = $1 AND endpoint = $2`, [me.id, String(body.endpoint || '')]);
      return send(res, 200, { on: !!r.rows[0] });
    }
    if (body.action === 'test') {
      const n = await pushToUser(me.id, { ...quotePayload(dayIn(tz)), tag: 'quote-test' });
      if (!n) return fail(res, 409, 'no_device', 'Notifications aren’t reaching this device. Turn them off and on again.');
      return send(res, 200, { ok: true, sent: n });
    }
    return fail(res, 400, 'action');
  } catch (e) {
    handleError(res, e);
  }
}
