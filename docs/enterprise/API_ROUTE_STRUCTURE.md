# API Route Structure

## Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/oauth/:provider/start`
- `GET /api/v1/auth/oauth/:provider/callback`
- `POST /api/v1/auth/2fa/verify`

## Admin

- `GET /api/v1/admin/realtime/metrics` (WebSocket bootstrap)
- `GET /api/v1/admin/analytics/overview`
- `GET /api/v1/admin/analytics/funnels`
- `POST /api/v1/admin/users/:id/suspend`
- `POST /api/v1/admin/users/:id/impersonate`
- `POST /api/v1/admin/vendors/:id/approve`
- `POST /api/v1/admin/vendors/:id/reject`
- `POST /api/v1/admin/finance/refunds/:orderId`

## Vendor

- `GET /api/v1/vendors/me/dashboard`
- `GET /api/v1/vendors/me/analytics`
- `POST /api/v1/vendors/me/products`
- `POST /api/v1/vendors/me/products/bulk-upload`
- `PATCH /api/v1/vendors/me/products/:id`
- `GET /api/v1/vendors/me/payouts`

## User

- `GET /api/v1/users/me/dashboard`
- `GET /api/v1/users/me/orders`
- `GET /api/v1/users/me/wishlists`
- `POST /api/v1/users/me/wishlists/share`
- `GET /api/v1/users/me/rewards`

## Commerce

- `GET /api/v1/products`
- `GET /api/v1/products/:slug`
- `POST /api/v1/cart/items`
- `POST /api/v1/checkout/intents`
- `POST /api/v1/checkout/confirm`

## Growth

- `POST /api/v1/growth/referrals/claim`
- `GET /api/v1/growth/referrals/leaderboard`
- `POST /api/v1/growth/coupons`
- `POST /api/v1/growth/affiliate/links`

## Compliance

- `POST /api/v1/compliance/data-export`
- `POST /api/v1/compliance/delete-account`
- `POST /api/v1/compliance/consent`

## Webhooks

- `POST /api/v1/webhooks/stripe`
- `POST /api/v1/webhooks/posthog`
- `POST /api/v1/webhooks/notifications`