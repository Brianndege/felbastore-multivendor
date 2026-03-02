# Role Structure (RBAC + ABAC)

## Admin Roles

- `super_admin`: full platform control
- `finance_admin`: refunds, chargebacks, payouts, tax exports
- `risk_admin`: fraud queues, bans, IP controls, risk policy
- `support_admin`: support workflows, tagged notes, secure impersonation

## Vendor Roles

- `vendor_owner`: full vendor workspace + billing controls
- `vendor_manager`: products, campaigns, orders, team-level ops
- `vendor_staff`: limited order/review/inventory operations

## User Roles

- `customer`: shopping and account functions
- `affiliate`: tracked referral link and payout reporting
- `influencer`: campaign links, attribution, leaderboard
- `ambassador`: milestones and community challenge functions

## Access Model

- RBAC for coarse-grained role permissions
- ABAC policies for tenant scope, ownership, and risk level
- Step-up auth (2FA re-check) for sensitive actions