# Affiliate Fallback + Dummy Cleanup Runbook

## Safe Dummy Product Cleanup

### Detection criteria
Dummy/seed products are matched by one or more of:

- `Product.isDummy = true`
- `Product.createdBy = "seed_script"`
- `Product.tags` include `sample`, `test`, or `demo`
- Product name contains `sample`, `test`, or `demo`

Products referenced by `OrderItem` are skipped automatically to avoid FK/data-loss risk.

### Admin API (password-confirmed)

Endpoint: `POST /api/admin/products/cleanup-dummy`

Required:

- Admin session
- Admin password (`adminPassword`)
- Confirmation phrase: `DELETE_DUMMY_PRODUCTS`

Body example:

```json
{
  "adminPassword": "<admin-password>",
  "confirmPhrase": "DELETE_DUMMY_PRODUCTS",
  "dryRun": true
}
```

Safety behavior:

- Full backup snapshot written to:
  - DB backup table (`AdminCleanupBackup`)
  - JSON artifact under `artifacts/cleanup-backups/`
- Run audit logged in `AdminCleanupRun` with admin id/email and timestamp.
- Transactional delete for related records.
- Search index rebuild after deletion.

### CLI script

Dry run:

```bash
npm run cleanup:dummy:dry -- --admin-email=<admin@email> --admin-password=<password>
```

Apply deletion:

```bash
npm run cleanup:dummy:apply -- --admin-email=<admin@email> --admin-password=<password>
```

---

## Vendor Onboarding + Publish Readiness

Checklist endpoint:

- `GET /api/vendor/onboarding-checklist`

Checks:

- Email verified
- Store profile completed
- Payment details added
- Store settings configured

Publish/submission (`PENDING_APPROVAL`) is blocked when checklist is incomplete.

---

## Affiliate Fallback System

### Data model

- `Product.productType` (`vendor` / `affiliate` marker for first-party catalog entries)
- `AffiliateProduct`
- `AffiliateClick`
- `AffiliateConversion`
- `AffiliateSyncRun`

### Feed strategy

Endpoint: `GET /api/products/feed`

- Prioritizes approved live vendor products.
- If vendor count is below threshold (`AFFILIATE_FALLBACK_THRESHOLD`, default `12`), blends affiliate products.
- Returns featured/trending affiliate slices for merchandising.

### Outbound tracking

Endpoint: `GET /api/affiliate/outbound/[id]`

- Logs click to `AffiliateClick`
- Appends tracking params (`utm_*`, `aff_click`, `aff_network`, `aff_product`)
- Redirects to partner URL

### Conversion tracking

Endpoint: `POST /api/affiliate/conversions/webhook`

Header required:

- `x-affiliate-webhook-secret: <AFFILIATE_WEBHOOK_SECRET>`

Records conversion to `AffiliateConversion` for affiliate revenue analytics.

### Sync architecture

Internal job endpoint:

- `POST /api/internal/jobs/affiliate-sync`
- Header: `x-job-key: <AFFILIATE_SYNC_JOB_KEY>`

Supports integration modes:

- `api`
- `feed`
- `deeplink`

Network registry endpoint:

- `GET /api/affiliate/networks`

Covers:

- Amazon Associates
- CJ Affiliate
- ShareASale
- Rakuten Advertising
- Impact.com
- Awin
- Shopify stores
- eBay Partner Network
- Walmart Affiliate
- AliExpress Portals
- Etsy Affiliate
- Envato
- ClickBank

---

## Admin Analytics

- `GET /api/admin/overview-metrics`
  - Active vendors
  - Products live
  - Pending approvals

- `GET /api/admin/affiliate/analytics`
  - Top affiliate store/network
  - CTR
  - Revenue by category
  - Revenue and clicks by network

---

## Frontend Disclosure & SEO

- Product list shows affiliate labels (`Sold by Partner`, `External Store`)
- Affiliate disclosure text on product list and affiliate detail page
- Affiliate outbound links use `rel="sponsored nofollow noopener"`
- Dedicated affiliate product page with canonical URL and Product structured data
