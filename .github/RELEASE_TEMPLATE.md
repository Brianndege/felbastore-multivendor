## Release Summary

- Version/tag:
- Release date (UTC):
- Commit SHA:
- Owner:

## Required Gate Evidence

- [ ] Inventory Ops Smoke Gate passed
  - Workflow: `.github/workflows/inventory-ops-smoke-gate.yml`
  - Run URL:
- [ ] Inventory Dedupe Check passed
  - Workflow: `.github/workflows/inventory-dedupe-check.yml`
  - Run URL:

## Environment & Secrets Validation

- [ ] `APP_URL` verified
- [ ] `INVENTORY_SCAN_JOB_KEY` verified
- [ ] `INVENTORY_SCAN_LOOKBACK_HOURS` / `INVENTORY_SCAN_MAX_PRODUCTS` verified (if set)

## Post-Deploy Validation

- [ ] Inventory scan endpoint returns success
- [ ] Dedupe behavior verified (second immediate scan creates `0` new alerts)
- [ ] Admin live monitoring panel shows expected scan summary
- [ ] Reconnect counters and unstable badge behavior verified

## Risk & Rollback

- Known risks:
- Mitigations:
- Rollback artifact/version:
- Rollback plan validated: Yes / No

## Evidence Links

- Release evidence doc (copied from template):
  - `docs/enterprise/RELEASE_EVIDENCE_TEMPLATE.md`
- Incident/issues (if any):
- Monitoring dashboard links:

## Approvals

- Reviewer(s):
- Final sign-off timestamp (UTC):
