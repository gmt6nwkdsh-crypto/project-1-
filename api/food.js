// Barcode lookup in Open Food Facts (free public food database, no key needed).
// GET /api/food?barcode=0123456789012 -> { found, product: { name, brand, serving, servingG, per100: {cal,p,c,f}, perServing: {cal,p,c,f} | null } }
import { send, fail, currentUser, handleError } from '../lib/http.js';

const OFF = process.env.OFF_BASE || 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments';
const UA = 'AndradeMacros/1.0 (free personal calorie tracker; https://project-1-flax-six-30.vercel.app)';

const num = v => { const n = typeof v === 'string' ? parseFloat(v) : +v; return Number.isFinite(n) && n >= 0 ? n : null; };

function macros(n, suffix) {
  let cal = num(n['energy-kcal' + suffix]);
  if (cal == null) { const kj = num(n['energy-kj' + suffix]) ?? num(n['energy' + suffix]); if (kj != null) cal = kj / 4.184; }
  const p = num(n['proteins' + suffix]), c = num(n['carbohydrates' + suffix]), f = num(n['fat' + suffix]);
  if (cal == null && p == null && c == null && f == null) return null;
  const out = { cal: cal ?? ((p || 0) * 4 + (c || 0) * 4 + (f || 0) * 9), p: p || 0, c: c || 0, f: f || 0 };
  for (const k in out) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}

async function lookup(code) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(OFF + encodeURIComponent(code) + '.json?fields=' + FIELDS, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error('off ' + r.status); e.code = 'lookup_failed'; throw e; }
    const j = await r.json();
    return j && j.status === 1 && j.product ? j.product : null;
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return fail(res, 405, 'method');
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'signed_out', 'You’ve been signed out. Sign in again.');
    const code = String(new URL(req.url, 'http://x').searchParams.get('barcode') || '').replace(/\D/g, '');
    if (code.length < 6 || code.length > 14) return fail(res, 400, 'bad_barcode', 'That doesn’t look like a barcode number.');

    // US packages print 12-digit UPC-A codes; the database often stores them as 13 digits with a leading 0
    const tries = [code];
    if (code.length === 12) tries.push('0' + code);
    if (code.length === 13 && code[0] === '0') tries.push(code.slice(1));
    let p = null;
    try {
      for (const c of tries) { p = await lookup(c); if (p) break; }
    } catch (e) {
      console.error('food lookup', e && e.message);
      return fail(res, 502, 'lookup_failed', 'The food database didn’t answer. Try again, or snap the label instead.');
    }
    res.setHeader('Cache-Control', 'private, max-age=86400');
    if (!p) return send(res, 200, { found: false, barcode: code });
    const n = p.nutriments || {};
    const per100 = macros(n, '_100g');
    const perServing = macros(n, '_serving');
    const servingG = num(p.serving_quantity);
    if (!per100 && !perServing) return send(res, 200, { found: false, barcode: code, reason: 'no_nutrition', name: p.product_name || '' });
    const name = String(p.product_name_en || p.product_name || p.generic_name || 'Scanned food').trim().slice(0, 80);
    const brand = String(p.brands || '').split(',')[0].trim().slice(0, 40);
    return send(res, 200, {
      found: true,
      barcode: code,
      product: { name, brand, serving: String(p.serving_size || '').slice(0, 60), servingG: servingG && servingG < 5000 ? servingG : null, per100, perServing }
    });
  } catch (e) {
    handleError(res, e);
  }
}
