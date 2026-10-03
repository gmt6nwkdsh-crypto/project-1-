// Web push without extra packages: VAPID sign-in (RFC 8292) and payload encryption (RFC 8291, aes128gcm).
import crypto from 'node:crypto';
import { query } from './db.js';

const b64u = b => Buffer.from(b).toString('base64url');
const fromB64u = s => Buffer.from(String(s), 'base64url');

let keys = null;
// Keys are made once and kept in the database, so nobody has to paste them into Vercel.
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url) override them if set.
export async function vapidKeys() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
    return keys;
  }
  const r = await query(`SELECT value FROM app_kv WHERE key = 'vapid'`);
  if (r.rows[0]) { keys = r.rows[0].value; return keys; }
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const made = { pub: b64u(ecdh.getPublicKey()), priv: b64u(ecdh.getPrivateKey()) };
  await query(`INSERT INTO app_kv (key, value) VALUES ('vapid', $1::jsonb) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(made)]);
  const again = await query(`SELECT value FROM app_kv WHERE key = 'vapid'`); // another request may have won the race
  keys = again.rows[0].value;
  return keys;
}

function privateKeyObject(pubB64, privB64) {
  const pub = fromB64u(pubB64);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: privB64, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
}

function vapidJWT(endpoint, k, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: privateKeyObject(k.pub, k.priv), dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u(sig);
}

// Encrypts the message so only that browser can read it.
export function encryptPayload(text, p256dh, authSecret) {
  const uaPublic = fromB64u(p256dh), auth = fromB64u(authSecret);
  const ecdh = crypto.createECDH('prime256v1');
  const asPublic = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(65, 20);
  return Buffer.concat([header, asPublic, ct]);
}

// Sends one notification. Returns 'ok', 'gone' (subscription expired: delete it) or 'error'.
export async function sendPush(sub, payload, subject) {
  const k = await vapidKeys();
  const body = encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);
  try {
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${vapidJWT(sub.endpoint, k, subject)}, k=${k.pub}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '43200',
        Urgency: 'normal'
      },
      body
    });
    if (r.status === 404 || r.status === 410) return 'gone';
    if (!r.ok) { console.error('push', r.status, (await r.text().catch(() => '')).slice(0, 200)); return 'error'; }
    return 'ok';
  } catch (e) {
    console.error('push', e && e.message);
    return 'error';
  }
}
