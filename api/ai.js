// AI estimates (photo, label, describe, food ideas, coach insights) on the owner's Anthropic API key.
// POST { prompt, images: ["data:image/jpeg;base64,..."], tier: "default" | "quick" } -> { text }
import { query } from '../lib/db.js';
import { send, fail, readJson, currentUser, sameOrigin, handleError } from '../lib/http.js';

const MODELS = {
  default: process.env.AI_MODEL || 'claude-sonnet-5-5',
  quick: process.env.AI_MODEL_QUICK || 'claude-haiku-4-5-20251001'
};
const DAILY_LIMIT = Math.max(1, parseInt(process.env.AI_DAILY_LIMIT || '40', 10));
const API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const IMG = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // lets the page know whether estimates are switched on
      return send(res, 200, { enabled: !!process.env.ANTHROPIC_API_KEY, images: true, dailyLimit: DAILY_LIMIT });
    }
    if (req.method !== 'POST') return fail(res, 405, 'method');
    if (!sameOrigin(req)) return fail(res, 403, 'origin');
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'signed_out', 'You’ve been signed out. Sign in again.');
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return fail(res, 503, 'ai_off', 'AI estimates aren’t switched on yet. Use Manual entry for now.');

    const body = await readJson(req, 4.4 * 1024 * 1024);
    const prompt = String(body.prompt || '');
    if (!prompt || prompt.length > 24000) return fail(res, 400, 'bad_prompt');
    const images = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
    const content = [];
    for (const im of images) {
      const m = IMG.exec(String(im));
      if (!m) return fail(res, 400, 'image_rejected', 'That image couldn’t be read. Try a JPEG or PNG photo.');
      content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
    }
    content.push({ type: 'text', text: prompt });

    // daily cap per person so a runaway loop can't drain the credit
    const used = await query(
      `INSERT INTO ai_usage (user_id, day, count) VALUES ($1, current_date, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1 RETURNING count`,
      [me.id]
    );
    if (used.rows[0].count > DAILY_LIMIT) {
      return fail(res, 429, 'rate_limited', `You’ve used today’s ${DAILY_LIMIT} AI estimates. Use Manual entry until tomorrow.`);
    }

    const tier = body.tier === 'quick' ? 'quick' : 'default';
    const r = await fetch(API + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS[tier], max_tokens: 2000, messages: [{ role: 'user', content }] })
    });
    const out = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = out && out.error && out.error.message ? String(out.error.message) : '';
      console.error('anthropic', r.status, msg);
      if (r.status === 429 || r.status === 529) return fail(res, 429, 'busy', 'The estimator is busy right now. Try again in a minute.');
      if (r.status === 400 && /image/i.test(msg)) return fail(res, 400, 'image_rejected', 'That image couldn’t be read. Try a JPEG or PNG photo.');
      if (/credit|billing|balance/i.test(msg)) return fail(res, 503, 'ai_off', 'AI estimates are paused right now. Use Manual entry for now.');
      return fail(res, 502, 'ai_error', 'The estimate didn’t come back. Try again.');
    }
    const text = (out && Array.isArray(out.content) ? out.content : []).filter(c => c.type === 'text').map(c => c.text).join('');
    if (!text) return fail(res, 502, 'empty_completion', 'No estimate came back. Try again with a note about the meal.');
    return send(res, 200, { text, left: Math.max(0, DAILY_LIMIT - used.rows[0].count) });
  } catch (e) {
    handleError(res, e);
  }
}
