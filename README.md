# Andrade Macros

A free calorie and macro tracker for friends and family. Username-and-password accounts (no email), a food log that syncs across every device, photo and label estimates, weight trend, and weekly insights.

## How it's built

- `public/index.html` is the whole app screen (phone-first, one page).
- `api/` runs on Vercel as small server functions:
  - `auth.js` creates accounts, signs people in and out, changes passwords, deletes accounts.
  - `doc.js` saves and loads each person's settings, weigh-ins and daily logs.
  - `ai.js` sends photos and meal descriptions to the Anthropic API for estimates.
- `lib/` holds the shared database and request helpers.
- The database tables are created automatically the first time the site runs.

## Settings in Vercel (Environment Variables)

| Name | What it is |
|---|---|
| `DATABASE_URL` | Added automatically when the Neon database is connected to the project. `STORAGE_URL` or `POSTGRES_URL` also work. |
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com. Without it, the app works but photo estimates show "coming soon." |
| `AI_DAILY_LIMIT` | Optional. Estimates each person can run per day. Default 40. |
| `AI_MODEL` / `AI_MODEL_QUICK` | Optional. Models for estimates and for quick food ideas. Defaults: `claude-sonnet-5-5` and `claude-haiku-4-5-20251001`. |

After changing a setting, redeploy (Deployments → ⋯ → Redeploy) so it takes effect.

## Privacy and safety

- Passwords are stored as scrypt hashes, never as text.
- Sign-ins use a secure, HTTP-only cookie. "Keep me signed in" lasts 180 days.
- 8 wrong passwords in a row locks that account for 15 minutes.
- At most 5 new accounts per network per hour.
- Each person can only read and write their own data.

## Running it on a computer

```
npm install
DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... npm run dev
```

Then open http://localhost:3000.
