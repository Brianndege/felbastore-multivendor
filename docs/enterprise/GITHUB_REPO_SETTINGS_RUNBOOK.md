# GitHub Repo Settings Runbook (Inventory Release Gate)

This runbook configures GitHub so production releases are blocked unless inventory automation checks pass.

## 1) Prerequisites

- Repository admin access
- Existing workflows in default branch:
   - `.github/workflows/governance-consistency.yml`
   - `.github/workflows/inventory-env-validate.yml`
  - `.github/workflows/inventory-ops-smoke-gate.yml`
  - `.github/workflows/inventory-dedupe-check.yml`
- Repository secrets configured:
   - `APP_URL` (must be a publicly reachable deployed URL for GitHub-hosted runners; do not use localhost)
  - `INVENTORY_SCAN_JOB_KEY`
  - `INVENTORY_SCAN_SLACK_WEBHOOK_URL` (optional)

## 2) Configure Branch Protection (Default Branch)

1. Open repository on GitHub.
2. Go to `Settings` → `Branches`.
3. Under **Branch protection rules**, select default branch rule (or create one).
4. Enable:
   - `Require a pull request before merging`
   - `Require status checks to pass before merging`
5. Add required status checks:
   - `governance-consistency / governance-consistency`
   - `inventory-env-validate / inventory-env-validate`
   - `inventory-ops-smoke-gate / inventory-ops-smoke-gate`
   - `inventory-dedupe-check / inventory-dedupe-check`
   - `check-release-evidence / check-release-evidence`
6. Optional hardening:
   - `Require branches to be up to date before merging`
   - `Require conversation resolution before merging`
   - `Do not allow bypassing the above settings`

## 2.1) Enable Automated Release PR Evidence Checks

The workflow `.github/workflows/release-evidence-pr-check.yml` automatically comments on release PRs and fails the check when required workflow run URLs are missing from the PR description.

- Triggered on PR updates (`opened`, `edited`, `synchronize`, `reopened`, label changes)
- Treats a PR as release-related if title/body contains `release` or label `release` is present
- Posts/updates a sticky bot comment with missing evidence items
- Fails the workflow when required evidence links are missing (usable as required status check)

## 3) Configure Production Environment Protection

1. Go to `Settings` → `Environments`.
2. Create/select environment: `production`.
3. Enable protection rules:
   - `Required reviewers` (at least 1 approver)
   - `Wait timer` (optional, e.g. 5 minutes)
4. Add environment secrets if needed for production deploys.

## 4) Release Tagging Policy

Before creating a production tag:

1. Trigger workflow manually:
   - `Actions` → `Inventory Ops Smoke Gate` → `Run workflow`
2. Trigger workflow manually:
   - `Actions` → `Inventory Dedupe Check` → `Run workflow`
3. Verify both workflows are green.
4. Create release tag only from protected default branch commit.
5. Attach completed release evidence using `docs/enterprise/RELEASE_EVIDENCE_TEMPLATE.md`.
6. Use `.github/RELEASE_TEMPLATE.md` as the default GitHub release body checklist.

## 5) Failure Workflow

If either workflow fails:

1. Do **not** create release tag.
2. Open incident/task with:
   - failing workflow URL
   - root-cause summary
   - owner + ETA
3. Apply fix and redeploy target environment.
4. Re-run failed workflow(s).
5. Continue release only after both checks pass.

## 6) Quarterly Governance Check

Perform quarterly review:

- Confirm required checks are still enforced in branch protection.
- Confirm workflow file names and job names have not changed.
- Confirm secrets are valid and rotated where required.
- Confirm Slack failure notifications are delivered.
