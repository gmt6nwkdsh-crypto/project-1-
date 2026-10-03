// Friends: add each other by username and see streaks and protein days. Never food, weight or photos.
// GET  /api/friends -> { me, friends: [...], incoming: [...], outgoing: [...], nudgedBy: [...] }
// POST { action: 'add' | 'accept' | 'decline' | 'remove' | 'nudge', username }
import { query } from '../lib/db.js';
import { send, fail, readJson, currentUser, sameOrigin, handleError } from '../lib/http.js';
import { pushToUser, dayIn } from './push.js';

const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekOf = k => { const d = new Date(k + 'T12:00:00Z'); return addDays(k, -((d.getUTCDay() + 6) % 7)); };

// same rule as the app: one missed day per Mon-Sun week doesn't end a streak
function logStreak(logged, t) {
  let k = logged.has(t) ? t : addDays(t, -1), days = 0;
  const used = {};
  for (let i = 0; i < 400; i++) {
    if (logged.has(k)) { days++; k = addDays(k, -1); continue; }
    const w = weekOf(k);
    if (!used[w] && logged.has(addDays(k, -1))) { used[w] = true; k = addDays(k, -1); continue; }
    break;
  }
  return days;
}

async function findUser(username) {
  const u = String(username || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(u)) return null;
  const r = await query(`SELECT id, username, display_name FROM users WHERE username = $1`, [u]);
  return r.rows[0] || null;
}

async function overview(me) {
  const rel = await query(
    `SELECT f.user_id, f.friend_id, f.status, u.id AS other_id, u.username, u.display_name, u.tz
     FROM friends f JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
     WHERE f.user_id = $1 OR f.friend_id = $1`, [me.id]);
  const friends = new Map(), incoming = [], outgoing = [];
  for (const r of rel.rows) {
    const who = { username: r.username, name: r.display_name };
    if (r.status === 'accepted') { if (r.user_id === me.id) friends.set(String(r.other_id), { ...who, id: r.other_id, tz: r.tz }); }
    else if (r.friend_id === me.id) incoming.push(who);
    else outgoing.push(who);
  }
  const ids = [...friends.keys()];
  let list = [];
  if (ids.length) {
    const since = addDays(dayIn('America/New_York'), -60);
    const days = await query(
      `SELECT d.user_id, substr(d.doc_id, 5) AS date, coalesce(sum((e->>'cal')::numeric), 0) AS cal, coalesce(sum((e->>'p')::numeric), 0) AS p
       FROM docs d LEFT JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.data->'entries') = 'array' THEN d.data->'entries' ELSE '[]'::jsonb END) e ON true
       WHERE d.user_id IN (SELECT friend_id FROM friends WHERE user_id = $1 AND status = 'accepted')
         AND d.doc_id LIKE 'day-%' AND d.doc_id >= $2
       GROUP BY d.user_id, d.doc_id`, ['' + me.id, 'day-' + since]);
    const sets = await query(
      `SELECT user_id, (data->'targets'->>'p') AS target_p, coalesce(data->>'friendsShare', 'true') AS share
       FROM docs WHERE doc_id = 'settings' AND user_id IN (SELECT friend_id FROM friends WHERE user_id = $1 AND status = 'accepted')`, ['' + me.id]);
    const nudged = await query(`SELECT to_id FROM nudges WHERE from_id = $1 AND day = $2`, [me.id, dayIn('America/New_York')]);
    const nudgedSet = new Set(nudged.rows.map(r => String(r.to_id)));
    const byUser = {};
    for (const d of days.rows) (byUser[d.user_id] = byUser[d.user_id] || []).push({ date: d.date, cal: +d.cal, p: +d.p });
    const setBy = Object.fromEntries(sets.rows.map(s => [String(s.user_id), s]));
    list = ids.map(id => {
      const f = friends.get(id), st = setBy[id] || {}, share = st.share !== 'false';
      const out = { username: f.username, name: f.name, nudged: nudgedSet.has(id) };
      if (!share) return { ...out, private: true };
      const today = dayIn(f.tz), rows = (byUser[id] || []).filter(d => d.cal > 0);
      const logged = new Set(rows.map(d => d.date));
      const last7 = rows.filter(d => d.date > addDays(today, -7) && d.date <= today);
      const tp = +st.target_p || 0;
      return { ...out, streak: logStreak(logged, today), loggedToday: logged.has(today), daysLogged7: last7.length, proteinDays7: tp ? last7.filter(d => d.p >= tp * 0.9).length : null };
    }).sort((a, b) => (b.streak || 0) - (a.streak || 0));
  }
  const nb = await query(
    `SELECT u.display_name, u.username FROM nudges n JOIN users u ON u.id = n.from_id WHERE n.to_id = $1 AND n.day = $2`,
    [me.id, dayIn(me.tz || 'America/New_York')]);
  return { me: { username: me.username }, friends: list, incoming, outgoing, nudgedBy: nb.rows.map(r => r.display_name || r.username) };
}

export default async function handler(req, res) {
  try {
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'signed_out', 'You’ve been signed out. Sign in again.');
    const tzq = new URL(req.url, 'http://x').searchParams.get('tz');
    let tzOk = false; try { if (tzq) { new Intl.DateTimeFormat('en-US', { timeZone: tzq }); tzOk = true; } } catch {}
    if (tzOk) await query(`UPDATE users SET tz = $2 WHERE id = $1 AND tz IS DISTINCT FROM $2`, [me.id, tzq]);
    const tzr = await query(`SELECT tz FROM users WHERE id = $1`, [me.id]);
    me.tz = tzr.rows[0] && tzr.rows[0].tz;
    if (req.method === 'GET') return send(res, 200, await overview(me));
    if (req.method !== 'POST') return fail(res, 405, 'method');
    if (!sameOrigin(req)) return fail(res, 403, 'origin');
    const body = await readJson(req, 8 * 1024);
    const other = await findUser(body.username);
    if (!other) return fail(res, 404, 'no_user', 'No one has that username. Check the spelling with your friend.');
    if (other.id === me.id) return fail(res, 400, 'self', 'That’s you.');
    const pair = [me.id, other.id];

    if (body.action === 'add' || body.action === 'accept') {
      const theirs = await query(`SELECT status FROM friends WHERE user_id = $2 AND friend_id = $1`, pair);
      if (theirs.rows[0]) {
        // they asked first (or we're already friends): accepting makes it two-way
        await query(`UPDATE friends SET status = 'accepted' WHERE user_id = $2 AND friend_id = $1`, pair);
        await query(`INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`, pair);
        return send(res, 200, { ok: true, status: 'accepted', name: other.display_name });
      }
      if (body.action === 'accept') return fail(res, 404, 'no_request', 'That request was canceled.');
      const n = await query(`SELECT count(*)::int AS n FROM friends WHERE user_id = $1 AND status = 'pending'`, [me.id]);
      if (n.rows[0].n >= 30) return fail(res, 429, 'too_many', 'You have a lot of requests waiting. Cancel a few first.');
      await query(`INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING`, pair);
      return send(res, 200, { ok: true, status: 'pending', name: other.display_name });
    }
    if (body.action === 'decline' || body.action === 'remove') {
      await query(`DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`, pair);
      return send(res, 200, { ok: true });
    }
    if (body.action === 'nudge') {
      const f = await query(`SELECT 1 FROM friends WHERE user_id = $1 AND friend_id = $2 AND status = 'accepted'`, pair);
      if (!f.rows[0]) return fail(res, 403, 'not_friends', 'You can only nudge friends.');
      const day = dayIn('America/New_York');
      const ins = await query(`INSERT INTO nudges (from_id, to_id, day) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING 1`, [...pair, day]);
      if (!ins.rows[0]) return fail(res, 429, 'already', 'You already nudged them today.');
      const first = (me.display_name || me.username).split(' ')[0];
      const delivered = await pushToUser(other.id, { title: `${first} nudged you`, body: 'Time to log today. Keep that streak going.', tag: 'nudge-' + me.username, url: '/' });
      return send(res, 200, { ok: true, delivered });
    }
    return fail(res, 400, 'action');
  } catch (e) {
    handleError(res, e);
  }
}
