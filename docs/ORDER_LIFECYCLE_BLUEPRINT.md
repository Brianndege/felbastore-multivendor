# Multi-Vendor Order Lifecycle Blueprint

## 1. API Endpoints

### Customer APIs
- `POST /api/orders/create`
  - Creates order and vendor fulfillment rows in `PENDING`.
  - Sends customer/vendor notifications and order-created emails.
- `GET /api/orders`
  - Returns customer orders with aggregate lifecycle status and vendor fulfillment summaries.
- `GET /api/orders/:id`
  - Returns full order details with per-vendor fulfillment timelines and shipping metadata.
- `POST /api/orders/:id/lifecycle`
  - Customer lifecycle actions per vendor:
    - `confirm_receipt`
    - `open_dispute`
    - `request_refund`
- `GET /api/orders/:id/messages?vendorId=:vendorId`
  - Customer fetches per-vendor conversation timeline for an order.
- `POST /api/orders/:id/messages`
  - Customer sends vendor-scoped message (`vendorId`, `message`).

### Vendor APIs
- `GET /api/vendor/orders`
  - Vendor-scoped orders only, filtered by vendor fulfillment status.
- `GET /api/vendor/orders/:id`
  - Vendor-specific order detail with timeline, SLA timestamps, and tracking fields.
- `PATCH /api/vendor/orders/:id/status`
  - Enforces controlled lifecycle transitions.
  - Requires `shippingProvider` and `trackingNumber` when status is `shipped`.
  - Accepts optional tracking payload:
    - `trackingUrl`
    - `estimatedDeliveryAt`
  - Writes order audit trail and customer notifications.

### Admin/Automation APIs (recommended)
- `POST /api/internal/jobs/order-sla-reminders` (recommended)
  - Scans `PENDING` fulfillments past `confirmationDueAt`.
  - Sends vendor reminder and admin alerts.
- `POST /api/internal/jobs/order-auto-complete`
  - Auto-completes delivered fulfillments after grace period.
  - Releases payouts and emits completion notifications.

## 2. Database Schema Improvements

### New Enums
- `OrderLifecycleStatus`
  - `PENDING, CONFIRMED, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED, REFUNDED`
- `ShippingLifecycleStatus`
  - `PENDING, LABEL_CREATED, SHIPPED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION`

### New Tables
- `OrderVendorFulfillment`
  - Per-vendor lifecycle state, shipping/tracking fields, payout/dispute fields, stage timestamps.
- `OrderStatusAudit`
  - Immutable timeline/audit entries for all transitions.

### Existing Model Updates
- `Order`
  - `vendorFulfillments[]`, `statusAudits[]` relations.
- `Vendor`
  - `orderFulfillments[]` relation.

## 3. Lifecycle Rules

### Required Linear Flow
- `PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> IN_TRANSIT -> DELIVERED -> COMPLETED`

### Additional Terminal Paths
- `PENDING|CONFIRMED|PROCESSING -> CANCELLED`
- `SHIPPED|IN_TRANSIT|DELIVERED -> REFUNDED`

### Hard Guards
- Invalid transitions are blocked in API.
- Vendors can only mutate their own fulfillment rows.
- Customer lifecycle actions are scoped to order owner.

## 4. Frontend Dashboard Logic

### Customer Dashboard
Must show per vendor:
- lifecycle status
- shipping status
- carrier + tracking
- estimated delivery
- timeline events

Customer actions:
- confirm receipt
- open dispute
- request refund
- track shipment
- leave review (already available in delivered flow)
- message vendor directly from order detail

### Vendor Dashboard
Must show queues by fulfillment status:
- new pending confirmations
- processing queue
- shipped/in-transit queue
- completed queue

Vendor actions:
- confirm order
- move status with transition guard
- set tracking metadata when shipping
- resolve issues (dispute workflow)
- message customer directly from vendor order detail

## 5. Notifications

Send notifications/emails for:
- order placed (customer + vendor)
- vendor status updates
- shipping/tracking updates
- delivery and completion
- dispute/refund events

Payout safety:
- payout release only after completion
- payout frozen on dispute/refund request
