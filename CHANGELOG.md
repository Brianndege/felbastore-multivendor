# Changelog

## 2026-02-26

### Added
- Admin dashboard page with DB write health-check trigger and response panel.
- Expanded login support for admin account type with admin dashboard redirect.

### Changed
- Standardized protected API routes to use shared NextAuth auth options for reliable session enforcement.
- Improved vendor product upload handling (ensures upload directory exists, safe filename fallback, normalized status).
- Updated registration UI error handling to display API `message` when present.

### Database / Prisma
- Added unique constraints for reset and verification tokens.
- Extended `Notification` model with `type`, `priority`, and `data` fields.
- Extended `InventoryAlert` model with `type`, `threshold`, and `currentStock` fields.
- Synced schema and regenerated Prisma client.

### Ops
- Added comprehensive `/api/test-db` write health-check endpoint with cleanup and optional production key protection (`DB_HEALTHCHECK_KEY`).
- Pushed commit `b46a614` to `origin/main`.
