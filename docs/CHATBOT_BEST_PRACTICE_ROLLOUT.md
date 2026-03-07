# Chatbot Best-Practice Rollout (User, Vendor, Admin)

## Goal
Ship a reliable role-aware assistant without exposing sensitive data or creating support risk.

## Recommended phases
1. Phase 1 (User storefront)
- Scope: product Q&A, shipping policy, order-status lookup (own orders only), return policy.
- Surface: product pages and account/orders.
- Data source: curated FAQ + product metadata + public policy docs.

2. Phase 2 (Vendor dashboard)
- Scope: order ops guidance, inventory help, payout FAQ, policy checks.
- Surface: vendor dashboard and order detail pages.
- Data source: vendor-owned orders/products + vendor docs.

3. Phase 3 (Admin console)
- Scope: moderation summaries, operational runbook lookup, incident triage helper.
- Surface: admin dashboard.
- Data source: admin-only docs, moderation queues, audit summaries.

## Architecture
- Use retrieval-augmented generation (RAG) with role-based data partitions.
- Enforce authorization before retrieval, not only before response rendering.
- Store chat events for observability: actor role, route, prompt hash, response status.
- Add a strict action boundary: chatbot can suggest actions, but mutating actions remain explicit button/API flows.

## Guardrails
- Never return cross-tenant data.
- Redact secrets (tokens, keys, full card data, internal credentials).
- Add policy prompts for disallowed outputs (financial/legal guarantees, unsafe advice).
- Add confidence threshold and fallback to "I’m not sure" with human escalation links.

## Success metrics
- Deflection rate for support FAQs.
- Resolution rate without escalation.
- False/unsafe answer rate.
- Avg response latency and retrieval hit quality.

## MVP checklist
- Role-aware system prompts.
- Retrieval index split by audience (`user`, `vendor`, `admin`).
- Conversation telemetry with audit-safe logs.
- Clear UI label: "AI assistant can be wrong; verify important actions."
- Feedback controls: thumbs up/down + reason.
