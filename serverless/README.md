# Seemani serverless gift API

This is an optional, low-cost serverless backend for the static Seemani website. The site can stay on GitHub Pages; this API stores personalized gift messages and a YouTube video ID, never an audio/video file.

## Included

- Cloudflare Worker API: health check, create gift, read gift by opaque ID.
- Cloudflare D1 migration for gift metadata.
- YouTube URL validation for youtube.com, youtu.be, Shorts, live, and embed URLs.
- Input length limits, parameterized SQL, CORS allow-list, and a honeypot field.
- A small static front end lives in `/gift/` and can use this API after configuration.

## Deploy it

From the repository root, install Wrangler or use `npx wrangler`:

1. Log in: `npx wrangler login`
2. Create D1: `npx wrangler d1 create seemani-gifts`
3. Copy the returned database ID into `serverless/wrangler.toml` in place of `REPLACE_WITH_D1_DATABASE_ID`.
4. Apply schema: `npx wrangler d1 migrations apply seemani-gifts --remote --directory=serverless/migrations`
5. Deploy the Worker: `npx wrangler deploy --config serverless/wrangler.toml`
6. Test `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`. The response should contain `"ok":true`.
7. Open `gift/index.html` and replace `https://REPLACE-WITH-YOUR-WORKER.workers.dev` in `API_BASE` with the deployed Worker URL. Commit that change and deploy the static site through GitHub Pages.

Wrangler config paths are relative to the config file. If your Wrangler version expects the migration directory from the repository root, use `--directory=serverless/migrations` as shown and verify the command output before proceeding.

## API

- `GET /health`
- `POST /api/gifts` JSON body: `{ "recipient": "Priya", "sender": "You", "message": "A heartfelt note", "songUrl": "https://youtu.be/VIDEO_ID" }`
- `GET /api/gifts/{32-character-id}`

The create endpoint returns an ID. The front end builds a share link like `https://seemani.in/gift/?id=...`.

## Important before public launch

- **Not payment/order infrastructure.** Do not accept or trust prices or payment status through this API.
- Public creation endpoints can be abused. The honeypot is only a basic deterrent, not robust bot protection. Before promoting it publicly, add Cloudflare rate limiting/Turnstile and a deletion/retention process.
- Gift links are unlisted, not private: anyone with the URL can view the gift. Do not put passwords, sensitive personal information, or private data in messages.
- The API stores names, messages, YouTube video IDs, and timestamps. Add a privacy notice and a contact/deletion process before collecting real user data.
- YouTube playback is provided by YouTube's official embedded player; video availability, ads, region restrictions, and embed settings are controlled by YouTube.
- This repository does not include Cloudflare credentials. Deploying requires signing in to your Cloudflare account and creating the D1 database.
