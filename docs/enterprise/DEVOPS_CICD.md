# DevOps Pipeline and CI/CD

## Infrastructure as Code

- Terraform modules for VPC, RDS (PostgreSQL), Redis, S3, ECS/Lambda, WAF, CDN
- Environment layering: `dev`, `staging`, `prod`
- Secret storage: AWS Secrets Manager + KMS

## CI Pipeline

1. Install + cache dependencies
2. Type-check + lint
3. Unit/integration tests
4. Prisma schema validation + migration diff checks
5. Security scanning (SAST, dependency, secret scan)
6. Build artifacts

## CD Pipeline

- Staging deploy on merge to main
- Prod deploy on release tag with approval gate
- Blue/green rollout for API workers
- Canary release for high-risk features
- Rollback via previous immutable artifact

## Release Governance (Inventory Automation Gate)

- Before creating a production release tag, run `.github/workflows/inventory-ops-smoke-gate.yml` manually.
- Production tagging is allowed only when the smoke gate job passes.
- If the smoke gate fails, block release tagging until inventory scan and dedupe checks are green.

### GitHub Repository Enforcement Settings (Recommended)

Apply these settings in GitHub repository configuration to make the gate operationally enforceable:

1. **Branch protection (default branch)**
	- Enable “Require a pull request before merging”.
	- Enable “Require status checks to pass before merging”.
	- Add required checks:
	  - `governance-consistency / governance-consistency` (docs/workflow drift prevention)
	  - `inventory-env-validate / inventory-env-validate` (PR env preflight enforcement)
	  - `inventory-ops-smoke-gate / inventory-ops-smoke-gate` (manual pre-release check)
	  - `inventory-dedupe-check / inventory-dedupe-check` (manual regression check)
	  - `check-release-evidence / check-release-evidence` (release PR evidence enforcement)

2. **Environment protection (`production`)**
	- Configure a protected environment named `production`.
	- Require reviewer approval before deployment jobs that target `production`.
	- Use this as an additional approval gate after smoke checks pass.

3. **Release process policy**
	- Create release tags only from protected default branch commits.
	- Require links to successful workflow runs in release PR description:
	  - `.github/workflows/inventory-ops-smoke-gate.yml`
	  - `.github/workflows/inventory-dedupe-check.yml`
	- Enforce this with `.github/workflows/release-evidence-pr-check.yml` as a required status check.

4. **Failure handling policy**
	- If smoke gate fails, block release tagging.
	- Open incident/task with failure run URL and remediation owner.
	- Re-run gate only after fix is merged and deployed.

Detailed setup steps are documented in `docs/enterprise/GITHUB_REPO_SETTINGS_RUNBOOK.md`.

## Runtime Observability

- OpenTelemetry traces
- Error tracking with Sentry
- Metrics and alerting for latency, error rate, queue lag, payment failures

## Scheduled Jobs (Inventory Alert Automation)

Hourly low-stock automation is now available via:

- Internal endpoint: `POST /api/internal/jobs/inventory-alert-scan`
- Runner command: `npm run jobs:inventory-scan:safe` (preferred for manual/ops runs)

### Security Model

- Primary auth: header `x-job-key` matching `INVENTORY_SCAN_JOB_KEY`
- Fallback auth: admin session + CSRF validation (for manual/admin-triggered runs)
- Recommendation: use a dedicated long random key for production

### Required Environment Variables

- `INVENTORY_SCAN_JOB_KEY` (required for scheduler mode)
- `APP_URL` (or `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL`)
- `INVENTORY_SCAN_LOOKBACK_HOURS` (optional, default `24`)
- `INVENTORY_SCAN_MAX_PRODUCTS` (optional, default `250`)
- `INVENTORY_SCAN_REQUEST_TIMEOUT_MS` (optional, default `20000`)

### GitHub Scheduler Secrets

- `APP_URL`
- `INVENTORY_SCAN_JOB_KEY`
- `INVENTORY_SCAN_SLACK_WEBHOOK_URL` (optional, used for failure notifications)

### On-Demand Dedupe Regression Check (GitHub Actions)

- Workflow file: `.github/workflows/inventory-dedupe-check.yml`
- Trigger: manual (`workflow_dispatch`)
- Command executed: `npm run test:inventory-dedupe`
- Guardrails: fails fast if `APP_URL` is missing, non-HTTP(S), or localhost/`127.0.0.1`; runs `npm run jobs:inventory-scan:validate` before dedupe test

Required repository secrets:

- `APP_URL`
- `INVENTORY_SCAN_JOB_KEY`
- `INVENTORY_SCAN_LOOKBACK_HOURS` (optional)
- `INVENTORY_SCAN_MAX_PRODUCTS` (optional)
- `INVENTORY_SCAN_REQUEST_TIMEOUT_MS` (optional)
- `INVENTORY_SCAN_SLACK_WEBHOOK_URL` (optional, sends failure alerts)

### End-to-End Inventory Ops Smoke Gate (GitHub Actions)

- Workflow file: `.github/workflows/inventory-ops-smoke-gate.yml`
- Trigger: manual (`workflow_dispatch`)
- Command executed: `npm run verify:inventory-ops` (runs env preflight, connectivity diagnostics, scan job, then dedupe test)
- Purpose: run inventory scan + dedupe verification against deployed `APP_URL` before release decisions
- Guardrails: fails fast if `APP_URL` is missing, non-HTTP(S), or localhost/`127.0.0.1`; runs `npm run jobs:inventory-scan:validate` before verification

### Inventory Env Preflight Validation (GitHub Actions)

- Workflow file: `.github/workflows/inventory-env-validate.yml`
- Trigger: pull requests affecting inventory scan runner config + manual (`workflow_dispatch`)
- Command executed: `npm run jobs:inventory-scan:validate`
- Purpose: fail fast on invalid inventory scan env configuration without requiring network access

### Consolidated Release Readiness (GitHub Actions)

- Workflow file: `.github/workflows/release-readiness.yml`
- Trigger: manual (`workflow_dispatch`)
- Command executed: `npm run verify:release-readiness`
- Purpose: run governance consistency + inventory ops verification as one release go/no-go check

### API Trigger Example

```bash
curl -X POST "$APP_URL/api/internal/jobs/inventory-alert-scan" \
	-H "Content-Type: application/json" \
	-H "x-job-key: $INVENTORY_SCAN_JOB_KEY" \
	-d '{"lookbackHours":24,"maxProducts":250}'
```

### GitHub Actions Hourly Schedule Example

Create `.github/workflows/inventory-scan.yml`:

```yaml
name: Inventory Alert Scan

on:
	schedule:
		- cron: "0 * * * *"
	workflow_dispatch:

jobs:
	run-inventory-scan:
		runs-on: ubuntu-latest
		steps:
			- name: Trigger internal inventory scan endpoint
				run: |
					curl -X POST "${{ secrets.APP_URL }}/api/internal/jobs/inventory-alert-scan" \
						-H "Content-Type: application/json" \
						-H "x-job-key: ${{ secrets.INVENTORY_SCAN_JOB_KEY }}" \
						-d '{"lookbackHours":24,"maxProducts":250}'
```

### Alternative Scheduler Options

- Cloudflare Cron Triggers + Worker HTTP call
- AWS EventBridge Scheduler + API destination
- Google Cloud Scheduler + HTTPS target
- External uptime/cron services (if secrets can be stored securely)

### Operational Notes

- Endpoint emits outbox events (`inventory.alert_created`) for real-time admin feed
- Alert dedupe uses product + alert type + stock level within lookback window
- Keep `lookbackHours` aligned with scheduler cadence to avoid duplicate noise
- GitHub workflow retries the scan up to 3 times with exponential backoff (5s, 10s)
- Slack failure alerts are sent only when `INVENTORY_SCAN_SLACK_WEBHOOK_URL` is configured
- Admin live monitor instability badge threshold is configurable via `NEXT_PUBLIC_ADMIN_LIVE_UNSTABLE_THRESHOLD` (default `3`)