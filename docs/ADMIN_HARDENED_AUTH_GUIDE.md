# Hardened Admin Authentication Guide

## Overview

This project uses a hardened admin authentication flow with:

- Dynamic login URL: `/admin/login/<ACCESS_KEY>`
- One-time generated admin password
- Short-lived JWT admin session
- Admin-only security dashboard at `/admin/security`
- Rate limiting, CSRF origin checks, and audit logging

## 1. Generate Admin Login URL

Use one of these methods.

### Method A: From an active hardened admin session

1. Open `/admin/security`
2. Click `Generate Login Link`
3. A one-time URL is generated and copied

### Method B: Bootstrap (first-time / no session)

`POST /api/admin/generate-access`

Headers:

- `x-admin-login-key: <ADMIN_LOGIN_KEY>`
- `content-type: application/json`

Body:

```json
{
  "email": "ndegebrian4@gmail.com"
}
```

Response:

```json
{
  "loginUrl": "https://your-domain/admin/login/<ACCESS_KEY>",
  "expiresAt": "2026-03-06T10:00:00.000Z"
}
```

## 2. Generate One-Time Password

`POST /api/admin/generate-password`

Headers:

- `x-admin-login-key: <ADMIN_LOGIN_KEY>`
- `content-type: application/json`

Body:

```json
{
  "email": "ndegebrian4@gmail.com"
}
```

Response:

```json
{
  "password": "A9#d82!3kd@29fj",
  "expiresAt": "2026-03-05T11:15:00.000Z"
}
```

Passwords are one-time and invalidated immediately after successful use.

## 3. Login Procedure

1. Open generated URL: `/admin/login/<ACCESS_KEY>`
2. Enter admin email and generated password
3. System validates:
- admin email
- unused, unexpired access key
- unused, unexpired generated password
4. On success, both key and password are consumed and cannot be reused

If key is invalid/expired, user is redirected to `/`.

## 4. Session Behavior

- NextAuth JWT strategy is used
- Session max age is short (`1 hour`)
- Admin-specific session claim expires at `30 minutes`
- Idle timeout signs out admin after `30 minutes`
- Browser tab close sends a beacon to `/api/admin/session/close` to clear session cookies

## 5. Revoke Access Keys

From `/admin/security`:

1. In `Access Keys`, choose the key
2. Click `Revoke`
3. Key is marked used/revoked immediately

API alternative:

`DELETE /api/admin/security/access-keys`

```json
{
  "keyId": "<key-id>"
}
```

## 6. Security Recommendations

- Set strong values for:
- `NEXTAUTH_SECRET`
- `ADMIN_LOGIN_KEY`
- `ADMIN_DEFAULT_EMAIL`
- Keep admin generation responses out of logs and chat history
- Use HTTPS only in production
- Rotate `ADMIN_LOGIN_KEY` periodically
- Replace in-memory rate limiters with Redis for multi-instance deployments
- Add SIEM alerts for repeated `login_failure`, `key_generation`, and `password_generation` events
- Run Prisma migrations and Prisma client generation after schema updates
- In production, `ADMIN_DEFAULT_EMAIL` is required for key/password generation endpoints.
- In production, set `APP_URL` or `NEXT_PUBLIC_APP_URL` so generated admin login URLs use a trusted origin.
- Optional: tune password hashing cost with `ADMIN_PASSWORD_BCRYPT_ROUNDS` (default `12`).

## Data Models

Prisma models added:

- `AdminAccessKey`
- `AdminPassword`
- `AdminLoginLog`

They store hashed key/password values, expiration, one-time usage state, and security activity logs.
