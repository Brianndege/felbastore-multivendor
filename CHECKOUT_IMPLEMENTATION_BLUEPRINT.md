# Checkout Implementation Blueprint

This blueprint translates the requested checkout features into implementation-ready backend contracts and schema extensions for this codebase.

## 1) Scope and Principles

- Enforce checkout eligibility and payment rules on the server.
- Keep existing `Order`, `OrderItem`, and `Notification` models as the backbone.
- Add feature tables incrementally to avoid risky large migrations.
- Use status-driven workflows so admin, vendor, and user portals stay consistent.

---

## 2) Required Feature Mapping

### A. Location-Based Checkout Eligibility

Goal: only allow checkout if shipping address is inside vendor delivery coverage.

Implementation:
- Validate address coverage per vendor before order creation and again before payment confirmation.
- For multi-vendor carts, every vendor must pass coverage validation.

Coverage strategies:
- **Phase 1 (fast path):** radius-based (`centerLat`, `centerLng`, `radiusKm`).
- **Phase 2 (advanced):** polygon/geojson zones for precise boundaries.

### B. Payment Options

- `PAY_ON_DELIVERY` (PoD): always available by default and auto-approved.
- Vendor-defined payment options per product:
  - Created by vendor as `pending_admin`.
  - Visible/usable in checkout only after admin approval and activation.

### C. Buyer-Vendor Chatbox

- Thread must be scoped to an order (or pre-order inquiry).
- Real-time delivery via WebSocket or SSE.
- Persist all messages for audit/dispute handling.

### D. Delivery Scheduling + Real-Time Tracking

- User chooses available slot at checkout.
- Vendor/admin can reassign/update slot.
- Tracking timeline shown in user portal and updated from vendor/rider updates.

### E. Admin Dashboard Controls

- Approve/reject vendor payment methods.
- Monitor order states and SLA exceptions.
- Manage delivery schedules and slot capacity.

### F. Notifications (Email/SMS/Push)

- Trigger on order lifecycle milestones.
- Fan out by channel preference and availability.

---

## 3) Prisma Schema Extension Draft

Add the following models to `prisma/schema.prisma`.

```prisma
enum PaymentMethodKind {
  PAY_ON_DELIVERY
  CARD
  MPESA
  BANK_TRANSFER
  WALLET
  ESCROW
}

enum ApprovalStatus {
  pending_admin
  approved
  rejected
}

enum CoverageMode {
  radius
  polygon
}

enum DeliveryStatus {
  scheduled
  packed
  dispatched
  out_for_delivery
  delivered
  failed
  returned
  cancelled
}

enum ChatActorRole {
  user
  vendor
  admin
  system
}

enum NotificationChannel {
  email
  sms
  push
}

model VendorDeliveryZone {
  id            String       @id @default(cuid())
  vendorId      String
  name          String
  mode          CoverageMode @default(radius)
  centerLat     Decimal?     @db.Decimal(10, 7)
  centerLng     Decimal?     @db.Decimal(10, 7)
  radiusKm      Decimal?     @db.Decimal(8, 2)
  polygonGeoJson String?     @db.Text
  isActive      Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@index([vendorId, isActive])
}

model VendorPaymentMethod {
  id               String            @id @default(cuid())
  vendorId         String
  methodKind       PaymentMethodKind
  label            String
  config           String?           @db.Text
  approvalStatus   ApprovalStatus    @default(pending_admin)
  approvedByUserId String?
  approvedAt       DateTime?
  rejectionReason  String?           @db.Text
  isActive         Boolean           @default(false)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  products ProductPaymentMethod[]

  @@index([vendorId, approvalStatus, isActive])
}

model ProductPaymentMethod {
  id                    String @id @default(cuid())
  productId             String
  vendorPaymentMethodId String
  createdAt             DateTime @default(now())

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  vendorPaymentMethod VendorPaymentMethod @relation(fields: [vendorPaymentMethodId], references: [id], onDelete: Cascade)

  @@unique([productId, vendorPaymentMethodId])
  @@index([productId])
}

model DeliverySlot {
  id              String   @id @default(cuid())
  vendorId        String
  startAt         DateTime
  endAt           DateTime
  capacity        Int
  bookedCount     Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  vendor Vendor @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  schedules OrderDeliverySchedule[]

  @@index([vendorId, startAt, isActive])
}

model OrderDeliverySchedule {
  id                String         @id @default(cuid())
  orderId           String         @unique
  slotId            String?
  scheduledStartAt  DateTime?
  scheduledEndAt    DateTime?
  status            DeliveryStatus @default(scheduled)
  trackingJson      String?        @db.Text
  lastLocationLat   Decimal?       @db.Decimal(10, 7)
  lastLocationLng   Decimal?       @db.Decimal(10, 7)
  estimatedArrivalAt DateTime?
  updatedByRole     String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  slot  DeliverySlot? @relation(fields: [slotId], references: [id], onDelete: SetNull)

  @@index([status])
}

model OrderChatThread {
  id        String   @id @default(cuid())
  orderId   String   @unique
  userId    String
  vendorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  order    Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  messages OrderChatMessage[]

  @@index([userId])
  @@index([vendorId])
}

model OrderChatMessage {
  id         String       @id @default(cuid())
  threadId   String
  senderRole ChatActorRole
  senderId   String?
  message    String       @db.Text
  metaJson   String?      @db.Text
  createdAt  DateTime     @default(now())

  thread OrderChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}

model NotificationDispatch {
  id          String              @id @default(cuid())
  notificationId String
  channel     NotificationChannel
  destination String
  status      String              @default("queued")
  providerRef String?
  error       String?             @db.Text
  createdAt   DateTime            @default(now())
  sentAt      DateTime?

  @@index([notificationId])
  @@index([channel, status])
}

model PodRiskAssessment {
  id            String   @id @default(cuid())
  orderId       String   @unique
  score         Int
  riskLevel     String
  reasonsJson   String?  @db.Text
  recommendedAction String?
  reviewedByAdminId String?
  createdAt     DateTime @default(now())
}

model EscrowRecord {
  id             String   @id @default(cuid())
  orderId        String   @unique
  amount         Decimal  @db.Decimal(10, 2)
  currency       String   @default("KES")
  status         String   @default("held")
  releaseAt      DateTime?
  releasedAt     DateTime?
  disputeStatus  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model VendorRating {
  id           String   @id @default(cuid())
  vendorId     String
  orderId      String
  userId       String
  rating       Int
  review       String?  @db.Text
  isVerified   Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@unique([orderId, userId])
  @@index([vendorId, rating])
}
```

> Note: Existing `Order.status` and `Order.paymentStatus` may remain as strings initially for compatibility. Add enum migration later if desired.

---

## 4) API Contract Draft

All APIs below are `src/pages/api/...` style to match this project.

### Eligibility and Checkout

#### `POST /api/checkout/eligibility`
Request:
```json
{
  "address": {
    "line1": "...",
    "city": "Nairobi",
    "country": "KE",
    "lat": -1.286389,
    "lng": 36.817223
  },
  "items": [
    { "productId": "prod_1", "quantity": 2 }
  ]
}
```

Response:
```json
{
  "eligible": true,
  "vendorCoverage": [
    { "vendorId": "ven_1", "eligible": true, "zoneId": "zone_1", "distanceKm": 4.2 }
  ],
  "paymentOptions": [
    { "code": "PAY_ON_DELIVERY", "label": "Pay on Delivery", "requiresApproval": false },
    { "code": "MPESA", "label": "M-Pesa", "requiresApproval": false }
  ]
}
```

#### `POST /api/checkout/place-order`
- Re-validates stock, coverage, and selected payment method at commit time.
- Creates `Order`, `OrderItem`, `OrderDeliverySchedule`, optional `OrderChatThread`.

### Vendor Payment Method Management

#### `POST /api/vendor/payment-methods`
- Create vendor payment method request (`pending_admin`).

#### `POST /api/vendor/products/:id/payment-methods`
- Link approved vendor payment methods to a product.

#### `GET /api/vendor/payment-methods`
- List statuses (pending/approved/rejected/active).

### Admin Payment Method Approval

#### `GET /api/admin/payment-methods/pending`
- List pending requests with vendor metadata.

#### `POST /api/admin/payment-methods/:id/approve`
- Marks approved and `isActive=true`.

#### `POST /api/admin/payment-methods/:id/reject`
- Marks rejected with reason.

### Chat

#### `GET /api/orders/:id/chat`
- Get thread and message history (authorized user/vendor/admin only).

#### `POST /api/orders/:id/chat/messages`
- Send message.

#### `GET /api/orders/:id/chat/stream`
- SSE endpoint for live updates (or websocket channel equivalent).

### Delivery Scheduling + Tracking

#### `GET /api/delivery/slots?vendorId=...&date=YYYY-MM-DD`
- Returns available slots.

#### `POST /api/orders/:id/delivery/schedule`
- Assign/change slot with capacity checks.

#### `POST /api/orders/:id/delivery/tracking`
- Vendor/rider updates tracking state/location.

#### `GET /api/orders/:id/delivery/tracking`
- User portal timeline + ETA.

### Notifications

#### `POST /api/notifications/dispatch`
- Internal/event endpoint to fan out `email/sms/push`.

Payload:
```json
{
  "orderId": "ord_1",
  "event": "order.dispatched",
  "channels": ["email", "sms", "push"]
}
```

---

## 5) Dynamic Validation Rules

Execute these checks at both **eligibility** and **place-order** stages:

1. Product is active and approved.
2. Requested quantity <= inventory.
3. Address is in range for each vendor in cart.
4. Selected payment method is allowed for every line item.
5. Vendor payment method is approved and active.
6. Delivery slot exists, active, and has capacity.

If any check fails, return structured errors:

```json
{
  "code": "COVERAGE_OUT_OF_RANGE",
  "message": "Vendor X does not deliver to selected address.",
  "details": { "vendorId": "ven_1" }
}
```

---

## 6) Notification Event Matrix

- `order.created` -> email + push
- `payment.method.changed` -> email + push
- `payment.received` -> email + SMS
- `delivery.scheduled` -> push
- `delivery.dispatched` -> SMS + push
- `delivery.out_for_delivery` -> SMS + push
- `delivery.delivered` -> email + push
- `delivery.failed` -> email + SMS + push

---

## 7) Optional Feature Hooks

### Escrow
- Activate when `order.totalAmount >= ESCROW_THRESHOLD`.
- Hold funds in `EscrowRecord` until delivery confirmation or dispute timeout.

### Vendor Rating
- Allow rating only for delivered, verified orders.

### PoD Fraud Detection
- Compute `PodRiskAssessment` score from:
  - user failed-delivery history,
  - order value,
  - address anomaly,
  - recent rapid order bursts.
- Risk policy examples:
  - low: allow PoD,
  - medium: require OTP,
  - high: disable PoD and require prepaid method.

---

## 8) Rollout Plan (Low Risk)

### Phase 1
- Add coverage, vendor payment approval models, and eligibility API.
- Keep PoD default active.
- Add admin approval endpoints and simple dashboard list.

### Phase 2
- Add delivery slots + schedule/tracking APIs.
- Add order chat thread/messages + portal UI.

### Phase 3
- Add multi-channel dispatch table and background processor.
- Add optional escrow/rating/fraud scoring.

---

## 9) Suggested File Targets

- API routes: `src/pages/api/checkout/*`, `src/pages/api/delivery/*`, `src/pages/api/orders/[id]/chat/*`
- Admin routes: `src/pages/api/admin/payment-methods/*`
- Vendor routes: `src/pages/api/vendor/payment-methods/*`
- Domain helpers: `src/lib/checkout/*`, `src/lib/delivery/*`, `src/lib/risk/*`
- UI pages/components:
  - user portal tracking: `src/app/orders/[id]/page.tsx`
  - vendor payment settings: `src/app/vendors/dashboard/*`
  - admin approvals: `src/app/admin/dashboard/page.tsx`

---

## 10) Acceptance Criteria Checklist

- User cannot place order if any cart vendor is out of delivery range.
- Checkout shows only methods valid for all cart items/vendors.
- PoD is available by default.
- Vendor-added payment methods are hidden until admin-approved.
- User and vendor can exchange order-scoped chat messages.
- User sees real-time delivery status timeline.
- Admin can approve payment methods and manage delivery schedules.
- Notifications are sent on key lifecycle updates.
- Optional features can be toggled by configuration flags.
