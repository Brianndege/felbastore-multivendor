# Realtime + Security Architecture

## Realtime Architecture

- Producers: auth, checkout, order, payouts, fraud, campaign services
- Outbox pattern writes guaranteed domain events from transactional DB updates
- Queue workers normalize and publish events into Redis pub/sub
- WebSocket gateway broadcasts to tenant-safe channels

Channels:

- `admin.global`
- `admin.tenant.{tenantId}`
- `vendor.{vendorId}`
- `user.{userId}`
- `fraud.{tenantId}`

## Security Controls

- JWT access + rotating refresh tokens
- OAuth + optional/passkey-ready WebAuthn + TOTP 2FA
- WAF + CAPTCHA + rate limiting + bot detection
- Immutable audit logs for privileged actions
- Encryption at rest (KMS) and in transit (TLS)
- Risk scoring pipeline for fraud and suspicious activity

## SOC2 Readiness Baseline

- Access controls: role policy, access reviews, least privilege
- Change management: PR checks, approvals, deployment gating
- Availability: SLOs, incident response runbooks, alerting
- Confidentiality: secret management and key rotation
- Processing integrity: idempotency and webhook signature verification