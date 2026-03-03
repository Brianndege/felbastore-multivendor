# Netlify Production Deployment Guide

## Framework Detection

This project is **Next.js 15** (`next` dependency and app router structure under `src/app`).

- Build command: `npx prisma generate && npm run build`
- Publish directory: `.next`
- Netlify runtime integration: `@netlify/plugin-nextjs`

## Prerequisites

Set these environment variables in Netlify (Site settings → Environment variables):

- `DATABASE_URL`
- `DIRECT_URL`
- `NETLIFY_DATABASE_URL`
- `NETLIFY_DATABASE_URL_UNPOOLED`
- `NEXT_PUBLIC_API_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLIC_KEY`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional app-specific variables are documented in `.env.example`.

When `DATABASE_URL` is unavailable or malformed in local Netlify CLI build contexts, `scripts/run-next-build.cjs` automatically falls back to `NETLIFY_DATABASE_URL` and similarly maps `NETLIFY_DATABASE_URL_UNPOOLED` to `DIRECT_URL`.

## Deploy via Netlify CLI

1. Authenticate:

   ```bash
   npx netlify login
   ```

2. Link the project (first time only):

   ```bash
   npx netlify init
   ```

3. Preview deploy:

   ```bash
   npm run netlify:deploy:preview
   ```

   If local deploy packaging fails on Windows (for example, function size upload limits), trigger a remote preview build instead:

   ```bash
   npm run netlify:trigger:preview
   ```

4. Production deploy:

   ```bash
   npm run netlify:deploy:prod
   ```

   If Netlify CLI fails with `Error while uploading blobs to deploy store`, run a direct deploy after removing generated deploy-scoped blobs:

   ```bash
   # PowerShell
   Remove-Item -Recurse -Force .netlify/deploy/v1/blobs/deploy
   npx netlify deploy --prod --no-build --dir=.next --functions=.netlify/functions-internal
   ```

   This preserves the already-built app artifacts and bypasses the transient blob-upload failure path.

   Remote-trigger production fallback:

   ```bash
   npm run netlify:trigger:prod
   ```

## Database Schema Sync (Required)

When Prisma schema changes are included in a release, apply schema updates to the production database before or immediately after deploy.

1. Pull production DB values from Netlify:

   ```bash
   npx netlify env:get NETLIFY_DATABASE_URL --context production
   npx netlify env:get NETLIFY_DATABASE_URL_UNPOOLED --context production
   ```

2. Set env vars in your shell and push schema:

   ```bash
   # PowerShell example
   $env:DATABASE_URL = "<value from NETLIFY_DATABASE_URL>"
   $env:DIRECT_URL = "<value from NETLIFY_DATABASE_URL_UNPOOLED>"
   npx prisma db push --schema prisma/schema.prisma --skip-generate
   ```

This prevents runtime failures caused by missing columns/tables after auth or data-model updates.

## Post-Deploy Auth Smoke Checks

Run these checks on production after deploy:

```bash
npm run smoke:auth:prod
```

1. Page availability (`200` expected):

   - `/auth/login`
   - `/auth/forgot-password`
   - `/auth/otp`
   - `/auth/resend-verification`
   - `/auth/reset-password`
   - `/auth/verify-email`

2. API behavior:

   - `POST /api/auth/forgot-password` returns generic success messaging
   - `POST /api/auth/send-verification` returns generic success messaging
   - `POST /api/auth/request-otp` returns generic messaging with `challengeId`
   - Invalid token tests for `verify-email` and `reset-password` return `400` (not `500`)
   - `logout-all-devices` returns `401` when unauthenticated

## CI/CD

GitHub Actions workflow: `.github/workflows/netlify-deploy.yml`

- `main` branch push → production deploy (`--prod`)
- pull requests and non-`main` branch pushes → preview deploy
- after production deploy on `main`, CI runs `npm run smoke:auth:prod` as a release gate

Manual run support:

- Trigger **Netlify Deploy** via `workflow_dispatch` in GitHub Actions
- Select `deploy_target`:
   - `production` → deploy production + run `smoke:auth:prod`
   - `preview` → deploy preview

Standalone monitoring:

- Workflow: `.github/workflows/auth-smoke-monitor.yml`
- Runs daily at `02:15 UTC`
- Can also be run manually via `workflow_dispatch` with optional `base_url`
- Executes only `npm run smoke:auth:prod` (no deploy)
- Optional alerting: set `AUTH_SMOKE_SLACK_WEBHOOK_URL` repository secret to receive failure notifications
- Fallback alerting (when Slack webhook is not set): creates/updates a GitHub issue labeled `auth-smoke` and `incident`

Required repository secrets:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

## Dummy Product Cleanup & Cache Purge

Use these commands in order:

1. Read-only audit:

   ```bash
   node scripts/audit-dummy-products.cjs
   ```

2. Dry-run cleanup (admin password confirmation required):

   ```bash
   npm run cleanup:dummy:dry -- --admin-email=<admin_email> --admin-password=<admin_password>
   ```

3. Apply cleanup only after reviewing dry-run output:

   ```bash
   npm run cleanup:dummy:apply -- --admin-email=<admin_email> --admin-password=<admin_password>
   ```

What cleanup includes:

- Transactional deletion for flagged dummy products and dependent rows (`reviews`, `variants`, `inventory`, `search index`, cart/wishlist references)
- Backup artifact in `artifacts/cleanup-backups/`
- Search reindex (`ProductSearchIndex` rebuild)
- Cache invalidation hooks:
  - API no-store headers for `/api/products/feed`
  - Optional Upstash Redis key purge (if `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set)
  - Optional CDN purge webhook (if `CDN_PURGE_URL` and optional `CDN_PURGE_TOKEN` set)

## Google OAuth (Customer)

Set in Netlify production env:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Set with Netlify CLI (production context):

```bash
npx netlify env:set GOOGLE_CLIENT_ID "<google-client-id>" --context production
npx netlify env:set GOOGLE_CLIENT_SECRET "<google-client-secret>" --context production
```

Then trigger a production deploy so NextAuth reloads provider configuration:

```bash
npm run netlify:deploy:prod
```

Behavior:

- Login page shows `Continue with Google` for customer sign-in.
- Existing email links to existing user account via NextAuth adapter.
- New Google sign-in creates account with `emailVerified` set.
- Vendor email conflict is blocked and audited.

Verification checks:

```bash
curl -s https://felbastore.co.ke/api/auth/providers
```

- Expected: `google` appears in provider payload (alongside `credentials` and `otp`).
- Login page should show `Continue with Google`.

## Secure Admin Bootstrap

Command:

```bash
npm run admin:ensure
```

Required env:

- `ADMIN_DEFAULT_EMAIL`

Optional env:

- `ADMIN_DEFAULT_PASSWORD` (if omitted, a strong temporary password is generated and printed once)
- `ADMIN_DEFAULT_NAME`

Security behavior:

- No hardcoded fallback credentials
- Admin gets `mustChangePassword=true`
- Admin routes are RBAC-protected: `/admin/*` and `/dashboard/admin*`

## Serverless Functions

Custom functions live in `netlify/functions`.

- Health endpoint: `/.netlify/functions/health`
- Redirect alias: `/api/internal/health` → `/.netlify/functions/health`
- Edge functions can be added under `netlify/edge-functions` when route mappings are needed

## Rollback

If a release fails:

1. Open Netlify dashboard → Deploys.
2. Select the previous successful deploy.
3. Click **Publish deploy** to roll back instantly.

## Notes

- API routes under `src/pages/api` are deployed as Netlify functions via the Next.js plugin.
- Security headers, cache headers, and HTTPS redirect are configured in `netlify.toml`.
- Runtime env validation is enforced in production by `src/lib/env.ts`.
