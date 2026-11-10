# superai-usage

Anonymous usage counter behind the "people using SuperAi" numbers on the download page.

- `POST /ping` `{ id, os, version }` from the desktop app every 10 minutes while it is open.
  `id` is a random UUID created on the device. No IP address or account is stored; the
  country is Cloudflare's two-letter code for the request.
- `GET /stats` returns `online` (last 15 minutes), `today`, `week`, `month`, `total`,
  per-OS and per-country counts. Cached for 60 seconds.

## Deploy (once)

Run from this folder:

```bash
npx wrangler login
npx wrangler d1 create superai-usage
```

Paste the printed `database_id` into `wrangler.toml`, then:

```bash
npx wrangler d1 execute superai-usage --remote --file schema.sql
npx wrangler deploy
```

Put the printed `https://superai-usage.<account>.workers.dev` URL into `USAGE_ENDPOINT` in
`packages/desktop/usage.mjs` and `USAGE_URL` in the website's `index.html`.

## Local test

```bash
npx wrangler d1 execute superai-usage --local --file schema.sql
npx wrangler dev
```
