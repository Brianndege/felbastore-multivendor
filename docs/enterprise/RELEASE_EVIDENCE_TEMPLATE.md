# Release Evidence Template

Use this template for every production release to prove gate compliance.

## Release Metadata

- Release version/tag:
- Release date/time (UTC):
- Commit SHA:
- Release owner:
- Approver(s):

## Required Gate Evidence

- Inventory Ops Smoke Gate run URL:
  - Workflow: `.github/workflows/inventory-ops-smoke-gate.yml`
  - Result: PASS / FAIL
- Inventory Dedupe Check run URL:
  - Workflow: `.github/workflows/inventory-dedupe-check.yml`
  - Result: PASS / FAIL
- Hourly Inventory Scan latest successful run URL (optional but recommended):
  - Workflow: `.github/workflows/inventory-scan.yml`

## Passing PR Description Example

Copy this block into a release PR description (replace URLs with real run links):

```markdown
## Release Evidence

- inventory-ops-smoke-gate run URL:
  - https://github.com/<org>/<repo>/actions/runs/1234567890

- inventory-dedupe-check run URL:
  - https://github.com/<org>/<repo>/actions/runs/1234567891
```

The release evidence checker searches the PR description for both workflow keys and matching GitHub Actions run URLs.

## Environment and Secrets Check

- `APP_URL` verified
- `INVENTORY_SCAN_JOB_KEY` verified
- `INVENTORY_SCAN_SLACK_WEBHOOK_URL` configured (optional)
- `INVENTORY_SCAN_LOOKBACK_HOURS` / `INVENTORY_SCAN_MAX_PRODUCTS` verified (optional)

## Deployment Validation

- Deployment target environment: `production`
- Deployment URL:
- Health checks passed (yes/no):
- Admin live monitor checks passed (yes/no):
  - Latest scan summary visible
  - Reconnect counters visible
  - Unstable threshold behavior as expected

## Risk and Rollback

- Known risks:
- Mitigations applied:
- Rollback plan verified:
- Rollback artifact/version:

## Sign-off

- Release owner sign-off:
- Reviewer sign-off:
- Timestamp:
