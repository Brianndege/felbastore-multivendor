# Netlify Production Deployment Guide

## Framework Detection

This project is **Next.js 15** (`next` dependency and app router structure under `src/app`).

- Build command: `npx prisma generate && npm run build`
- Publish directory: `.next`
- Netlify runtime integration: `@netlify/plugin-nextjs`

## Prerequisites

Set these environment variables in Netlify (Site settings → Environment variables):

- `DATABASE_URL`
- `NEXT_PUBLIC_API_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLIC_KEY`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Optional app-specific variables are documented in `.env.example`.

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

   Remote-trigger production fallback:

   ```bash
   npm run netlify:trigger:prod
   ```

## CI/CD

GitHub Actions workflow: `.github/workflows/netlify-deploy.yml`

- `main` branch push → production deploy (`--prod`)
- pull requests and non-`main` branch pushes → preview deploy

Required repository secrets:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

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
