// Vercel Cron runs this once a day (see "crons" in vercel.json): today's quote to everyone who turned it on.
// Sending twice in one day does nothing, so a retry or a stray visit is harmless.
import { fail, handleError } from '../lib/http.js';
import { runDaily } from './push.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== 'Bearer ' + secret) return fail(res, 401, 'cron');
    return await runDaily(res);
  } catch (e) {
    handleError(res, e);
  }
}
