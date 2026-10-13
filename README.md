# Signal Desk — Disaster Alert Portal

Serverless news/alert portal on **Cloudflare Workers** with **Hono**, **D1**, and **R2**.

- Public feed of disaster alerts (`info` / `warning` / `critical`)
- Email/password auth with PBKDF2 hashing (Web Crypto) and an HTTP-only JWT cookie
- Authenticated post creation with optional image upload to R2

## Project layout

```
├── migrations/0001_init.sql   # D1 migration applied by Wrangler
├── schema.sql                 # Same schema, kept as a readable reference
├── public/                    # Vanilla HTML/CSS/JS static assets
├── src/
│   ├── index.ts               # Hono app
│   ├── middleware/auth.ts
│   ├── routes/auth.ts
│   ├── routes/posts.ts
│   ├── routes/files.ts        # Serves R2 objects
│   └── lib/                   # Password + session helpers
└── wrangler.jsonc
```

## Local setup

```bash
npm install
copy .dev.vars.example .dev.vars   # Windows
# cp .dev.vars.example .dev.vars  # macOS/Linux
```

Put a long random value in `.dev.vars` for `AUTH_SECRET`.

Apply the D1 schema to the **local** database (no Cloudflare account required for this step):

```bash
npx wrangler d1 migrations apply disaster-alerts --local
```

Generate TypeScript bindings after config changes:

```bash
npm run cf-typegen
```

Start the Worker:

```bash
npm run dev
```

Open [http://localhost:8787](http://localhost:8787). The database atomically promotes only the first registered account to `admin`; every later self-registered account receives the `user` role. Registration does not accept a role from the client.

Local D1 and R2 are simulated on disk under `.wrangler/`. Images are served from `/files/...` through the Worker (the bucket does not need to be public).

## Production resources and deploy

1. Log in: `npx wrangler login`
2. Create D1 and copy the printed `database_id` into `wrangler.jsonc`:

   ```bash
   npx wrangler d1 create disaster-alerts
   ```

3. Create the R2 bucket named in config:

   ```bash
   npx wrangler r2 bucket create disaster-alert-images
   ```

4. Apply migrations remotely:

   ```bash
   npx wrangler d1 migrations apply disaster-alerts --remote
   ```

5. Set the JWT signing secret (do not commit it):

   ```bash
   npx wrangler secret put AUTH_SECRET
   ```

6. Deploy:

   ```bash
   npx wrangler deploy
   ```

Optional dry run before deploy: `npx wrangler deploy --dry-run`.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `{ email, password, name }`; the first registered account becomes `admin`, later accounts are `user` |
| POST | `/api/auth/login` | No | `{ email, password }` |
| POST | `/api/auth/logout` | Cookie | Clears session |
| GET | `/api/auth/me` | Cookie | Current user or `null` |
| GET | `/api/posts` | No | Alert list |
| GET | `/api/posts/:id` | No | Alert detail |
| POST | `/api/posts` | Yes | `multipart/form-data`: `title`, `severity`, `content`, `image?` |
| GET | `/files/posts/:key` | No | Image from R2 |
