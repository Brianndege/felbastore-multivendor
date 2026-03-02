# Felbastore Multivendor E-Commerce Platform

A robust multivendor e-commerce platform with advanced payment integration, built with Next.js, TypeScript, Prisma, and shadcn UI components.

![Felbastore](https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)

## Repository

GitHub Repository: [https://github.com/Brianndege/felbastore-multivendor](https://github.com/Brianndege/felbastore-multivendor)

## Features

- **Multivendor Architecture** - Multiple vendors can register and sell products
- **User & Vendor Authentication** - Secure login and registration with email verification
- **Product Management** - Complete CRUD operations for product listings
- **Advanced Payment System** - Integration with Stripe for card payments and M-Pesa for mobile money
- **Order Management** - Comprehensive order tracking and management
- **Dashboards** - Dedicated dashboards for users, vendors, and administrators
- **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- **Email Notifications** - Automated emails for account actions and order updates
- **Invoice Generation** - Automatic creation of receipts and invoices
- **Secure Transactions** - Server-side validation and payment processing
- **Analytics** - Basic analytics for vendors and administrators

## Technology Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (with Prisma Accelerate support)
- **Authentication:** NextAuth.js
- **Payment:** Stripe, M-Pesa
- **Email:** Nodemailer
- **Deployment:** Netlify, Vercel (supported)

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- Bun (preferred) or npm
- PostgreSQL database
- Stripe account (for payment processing)
- M-Pesa developer account (optional, for mobile money)
- SMTP server (for email notifications)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Brianndege/felbastore-multivendor.git
cd felbastore-multivendor
```

2. Install dependencies:

```bash
bun install
# or
npm install
```

3. Set up environment variables:
   Copy `.env.example` to `.env` and update with your own values:

```bash
cp .env.example .env
```

4. Set up the database:

```bash
bunx prisma generate
bunx prisma db push
```

5. Run the development server:

```bash
bun run dev
# or
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Windows Startup Note

If your workspace is in OneDrive and `.next/trace` causes `EPERM`, this project uses `.next-runtime` by default on Windows. You can override it with:

```env
NEXT_DIST_DIR=".next-runtime"
```

The default startup scripts also auto-fallback to the next available port when `3000` is busy:

```bash
npm run dev
npm run start
```

`npm run start` also auto-runs `next build` if a production build is missing.

If you need strict fixed-port behavior, use:

```bash
npm run dev:strict
npm run start:strict
```

Quick startup smoke check (build + start + HTTP probe + shutdown):

```bash
npm run start:smoke
```

Quick development smoke check (dev start + HTTP probe + shutdown):

```bash
npm run dev:smoke
```

Run both smoke checks sequentially (dev then start):

```bash
npm run smoke:all
```

Run full smoke checks including DB-dependent E2E flows (card checkout + vendor bulk upload):

```bash
RUN_DB_E2E=true npm run test:smoke
```

By default, `npm run test:smoke` skips DB-dependent E2E checks unless `RUN_DB_E2E=true` is set.

### Admin Access (Hidden Login)

- Public login page (`/auth/login`) shows only Customer and Vendor options.
- Admin login is available at a separate route: `/auth/admin-login`.
- Set `ADMIN_LOGIN_KEY` to require a secret key for the admin login page.
- When `ADMIN_LOGIN_KEY` is set, open admin login via one of these methods:
   - `/auth/admin-login?k=YOUR_ADMIN_LOGIN_KEY` (first request)
   - or header `x-admin-access-key: YOUR_ADMIN_LOGIN_KEY`
- With query key flow, middleware sets a short-lived HttpOnly cookie and redirects to clean `/auth/admin-login` (without `k` in URL).
- In production, if `ADMIN_LOGIN_KEY` is not set, `/auth/admin-login` is disabled and returns `404`.

Create or update the default admin account:

```bash
npm run admin:ensure
```

Optional environment variables for admin seeding:

```env
ADMIN_DEFAULT_EMAIL="admin@felbastore.local"
ADMIN_DEFAULT_PASSWORD="Admin@12345!"
ADMIN_DEFAULT_NAME="Platform Admin"
```

Optional environment variable for admin login route protection:

```env
ADMIN_LOGIN_KEY="replace-with-strong-random-value"
```

Generate strong secrets quickly:

```bash
npm run secrets:generate
```

Use generated values for `NEXTAUTH_SECRET`, `ADMIN_LOGIN_KEY`, and (optionally) `ADMIN_DEFAULT_PASSWORD`.

### Daraja (M-Pesa) Sandbox Testing

1. Set Daraja values in `.env.local` (see `.env.example`).
2. Test OAuth connectivity:

```bash
npm run test:daraja
```

`test:daraja` only needs `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET`.

3. Trigger a real sandbox STK push:

```bash
npm run test:daraja:stk
```

`test:daraja:stk` also requires `MPESA_PASSKEY`, `MPESA_SHORTCODE`, and `MPESA_CALLBACK_URL`.

Optional: pass phone and amount directly:

```bash
npm run test:daraja:stk -- 2547XXXXXXXX 1
```

### Stripe Card Testing

Test Stripe API connectivity and PaymentIntent creation:

```bash
npm run test:stripe
```

For card-first checkout while M-Pesa is being finalized, set:

```env
NEXT_PUBLIC_ENABLE_MPESA="false"
```

### Deployment

#### Deploy to Netlify

1. Push your code to GitHub (or another Git provider)
2. Connect your repository to Netlify
3. Configure the build settings:
   - Build command: `npx prisma generate && NEXT_DISABLE_ESLINT=1 SKIP_TYPE_CHECK=1 npm run build`
   - Publish directory: `.next`
4. Add the following environment variables in Netlify:
   - `DATABASE_URL`: Your database connection string
   - `NEXTAUTH_SECRET`: A random string for NextAuth.js
   - `NEXTAUTH_URL`: Your deployed URL (e.g., https://your-app.netlify.app)
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
   - Other environment variables as needed
5. Deploy the site
6. Enable the Netlify Next.js plugin

#### Deploy to Vercel

1. Push your code to GitHub (or another Git provider)
2. Import the project in Vercel
3. Configure environment variables
4. Deploy

## Project Structure

```
felbastore-multivendor/
├── .next/               # Build output
├── prisma/              # Prisma schema and migrations
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and configurations
│   │   └── payments/    # Payment system architecture
│   ├── pages/           # Next.js Pages Router (API routes)
│   │   └── api/         # Backend API endpoints
│   └── types/           # TypeScript type definitions
├── .env.example         # Example environment variables
├── .gitignore           # Git ignore file
├── PAYMENT_SYSTEM.md    # Payment system documentation
├── README.md            # Project documentation
├── next.config.mjs      # Next.js configuration
└── package.json         # Project dependencies
```

## Documentation

The project includes several documentation files:

- **README.md**: This file with general project information
- **PAYMENT_SYSTEM.md**: Detailed documentation of the payment system architecture
- **AUTHENTICATION_TESTING.md**: Guide for testing authentication flows
- **TECHNICAL_AUDIT.md**: Technical audit of the platform with recommendations
- **DATABASE_SETUP.md**: Instructions for database setup and configuration

## CI Workflows

- **Hourly inventory scan**: [.github/workflows/inventory-scan.yml](.github/workflows/inventory-scan.yml)
   - Trigger: hourly (`cron`) + manual
   - Purpose: run inventory alert scan with retry/backoff
   - Optional alerting: Slack via `INVENTORY_SCAN_SLACK_WEBHOOK_URL`

- **On-demand dedupe regression**: [.github/workflows/inventory-dedupe-check.yml](.github/workflows/inventory-dedupe-check.yml)
   - Trigger: manual (`workflow_dispatch`)
   - Purpose: verify second immediate scan creates zero new alerts
   - Guardrails: rejects localhost/non-HTTP(S) `APP_URL`, runs `jobs:inventory-scan:validate` preflight

- **Inventory ops smoke gate**: [.github/workflows/inventory-ops-smoke-gate.yml](.github/workflows/inventory-ops-smoke-gate.yml)
   - Trigger: manual (`workflow_dispatch`)
   - Purpose: run `verify:inventory-ops` against deployed `APP_URL` as an end-to-end gate
   - Guardrails: rejects localhost/non-HTTP(S) `APP_URL`, runs `jobs:inventory-scan:validate` preflight

- **Inventory env validate**: [.github/workflows/inventory-env-validate.yml](.github/workflows/inventory-env-validate.yml)
   - Trigger: pull request changes to inventory scan runner/config + manual (`workflow_dispatch`)
   - Purpose: fail fast on invalid scan env configuration without network calls

- **Release evidence PR checker**: [.github/workflows/release-evidence-pr-check.yml](.github/workflows/release-evidence-pr-check.yml)
   - Trigger: pull request updates
   - Purpose: comments on release PRs and fails the check when required workflow run links are missing

- **Governance consistency**: [.github/workflows/governance-consistency.yml](.github/workflows/governance-consistency.yml)
   - Trigger: pull request changes to release-gate docs/workflows + manual (`workflow_dispatch`)
   - Purpose: verifies required workflow job IDs and required-check documentation stay aligned

- **Release readiness**: [.github/workflows/release-readiness.yml](.github/workflows/release-readiness.yml)
   - Trigger: manual (`workflow_dispatch`)
   - Purpose: runs governance + inventory ops checks as a single release go/no-go verification

- **Reusable Slack notifier action**: [.github/actions/notify-slack/action.yml](.github/actions/notify-slack/action.yml)
   - Docs: [.github/actions/notify-slack/README.md](.github/actions/notify-slack/README.md)

Common repository secrets used by these workflows:

- `APP_URL`
- `INVENTORY_SCAN_JOB_KEY`
- `INVENTORY_SCAN_SLACK_WEBHOOK_URL` (optional)

## Operations Checklist

### Pre-Deploy

- Confirm env vars are configured:
   - `APP_URL`
   - `INVENTORY_SCAN_JOB_KEY`
   - `INVENTORY_SCAN_LOOKBACK_HOURS` (optional)
   - `INVENTORY_SCAN_MAX_PRODUCTS` (optional)
   - `INVENTORY_SCAN_REQUEST_TIMEOUT_MS` (optional, default `20000`)
   - `NEXT_PUBLIC_ADMIN_LIVE_UNSTABLE_THRESHOLD` (optional)
- Confirm GitHub secrets are set for workflow execution.
- Run one-command local verification:
   - `npm run verify:inventory-ops` (runs env preflight + connectivity diagnostics + scan + dedupe)
- Run one-command release readiness verification:
   - `npm run verify:release-readiness`
- Run env preflight validation (no network call):
   - `npm run jobs:inventory-scan:validate`
- Run connectivity diagnostics (non-destructive):
   - `npm run diagnose:inventory-scan`
- Run safe scan chain (preflight + diagnostics + scan):
   - `npm run jobs:inventory-scan:safe`
- Optional individual checks:
   - `npm run jobs:inventory-scan:safe` (preferred)
   - `npm run jobs:inventory-scan` (raw scan only)
   - `npm run test:inventory-dedupe`

### Post-Deploy

- Trigger manual run of `.github/workflows/inventory-scan.yml`.
- Verify workflow returns `ok: true` and produces expected scan metrics.
- Trigger manual run of `.github/workflows/inventory-dedupe-check.yml`.
- Confirm dedupe check passes (second immediate scan creates `0` alerts).
- Verify admin dashboard live panel updates:
   - latest scan summary displayed
   - reconnect counters visible
   - unstable badge behavior matches configured threshold

### Release Gate (Required Before Production Tag)

- Optional consolidated run: trigger `.github/workflows/release-readiness.yml`.
- Trigger manual run of `.github/workflows/inventory-ops-smoke-gate.yml`.
- Proceed with production release tag only if the smoke gate workflow is green.
- If the gate fails, resolve inventory automation issues first (do not tag release).

GitHub settings checklist:

- Enable branch protection on default branch.
- Require status checks before merge.
- Include these checks in release process:
   - `governance-consistency / governance-consistency`
   - `inventory-env-validate / inventory-env-validate`
   - `inventory-ops-smoke-gate / inventory-ops-smoke-gate`
   - `inventory-dedupe-check / inventory-dedupe-check`
   - `check-release-evidence / check-release-evidence`

Detailed click-by-click setup: [docs/enterprise/GITHUB_REPO_SETTINGS_RUNBOOK.md](docs/enterprise/GITHUB_REPO_SETTINGS_RUNBOOK.md)
Release evidence template: [docs/enterprise/RELEASE_EVIDENCE_TEMPLATE.md](docs/enterprise/RELEASE_EVIDENCE_TEMPLATE.md)
GitHub release draft template: [.github/RELEASE_TEMPLATE.md](.github/RELEASE_TEMPLATE.md)

### Incident Triage (Quick)

- If scan job fails with `fetch failed`, run `npm run jobs:inventory-scan:validate` first to confirm env format.
- Run `npm run diagnose:inventory-scan` to verify APP_URL and endpoint reachability before retrying scan jobs.
- Prefer `npm run jobs:inventory-scan:safe` for manual runs (preflight + diagnostics + scan).
- If `APP_URL` is `http://localhost:3000`, ensure the app is running before scan (`npm run dev` or `npm run start`).
- For CI/GitHub workflows, `APP_URL` must be a reachable deployed HTTPS URL (never localhost).
- If unauthorized, rotate and re-sync `INVENTORY_SCAN_JOB_KEY` between env + GitHub secrets.
- If alerts are noisy, increase `lookbackHours` or reduce run cadence.
- If no alerts are created unexpectedly, inspect product inventory thresholds and `inventory <= lowStockThreshold` conditions.

## Payment System Architecture

The payment system implements a modular design with the following key features:

- **Provider Abstraction Layer**: Common interface for all payment methods
- **Idempotent Transaction Processing**: Prevents duplicate payments
- **Asynchronous Payment Workflow**: Handles webhooks and callbacks
- **Cart-Payment Integrity**: Server-side validation of order totals
- **Comprehensive Error Handling**: Robust error recovery and logging

For more details, see [PAYMENT_SYSTEM.md](./PAYMENT_SYSTEM.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please contact [support@felbastore.co.ke](mailto:support@felbastore.co.ke).

## Acknowledgements

- [Next.js](https://nextjs.org/) - The React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Prisma](https://prisma.io/) - Database toolkit
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [Stripe](https://stripe.com/) - Payment processing
- [Bun](https://bun.sh/) - JavaScript runtime and package manager
