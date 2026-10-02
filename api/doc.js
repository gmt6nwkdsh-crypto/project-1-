// One person's saved data: settings, weights, and one document per day.
// GET  /api/doc?id=settings        -> { data } (null if none)
// PUT  /api/doc?id=day-2026-10-02  body: the document
// GET  /api/doc?days_since=2026-09-01 -> { days: [...] }
import { query } from '../lib/db.js';
import { send, fail, readJson, currentUser, sameOrigin, handleError } from '../lib/http.js';

const DOC_ID = /^(settings|weights|day-\d{4}-\d{2}-\d{2})$/;
const MAX = 400 * 1024;

export default async function handler(req, res) {
  try {
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'signed_out', 'You’ve been signed out. Sign in again.');
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    const since = url.searchParams.get('days_since');

    if (req.method === 'GET' && since) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return fail(res, 400, 'bad_date');
      const r = await query(
        `SELECT data FROM docs WHERE user_id = $1 AND doc_id LIKE 'day-%' AND doc_id >= $2 ORDER BY doc_id`,
        [me.id, 'day-' + since]
      );
      return send(res, 200, { days: r.rows.map(x => x.data) });
    }

    if (!id || !DOC_ID.test(id)) return fail(res, 400, 'bad_id');

    if (req.method === 'GET') {
      const r = await query(`SELECT data FROM docs WHERE user_id = $1 AND doc_id = $2`, [me.id, id]);
      return send(res, 200, { data: r.rows[0] ? r.rows[0].data : null });
    }

    if (req.method === 'PUT') {
      if (!sameOrigin(req)) return fail(res, 403, 'origin');
      const body = await readJson(req, MAX);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(res, 400, 'bad_body');
      const json = JSON.stringify(body);
      if (json.length > MAX) return fail(res, 413, 'too_large', 'This day has too much data to save.');
      await query(
        `INSERT INTO docs (user_id, doc_id, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (user_id, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [me.id, id, json]
      );
      return send(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      if (!sameOrigin(req)) return fail(res, 403, 'origin');
      await query(`DELETE FROM docs WHERE user_id = $1 AND doc_id = $2`, [me.id, id]);
      return send(res, 200, { ok: true });
    }

    return fail(res, 405, 'method');
  } catch (e) {
    handleError(res, e);
  }
}
