# KC Platform — Production Architecture (Multi-Center IMS + RMS)

> **Scope:** Production-grade architecture for the Knowledge Center platform running across **multiple centers (branches)**, **many users**, and a **fleet of RMS kiosk screens** — plus analytics and product recommendations.
> **Audience:** Any developer or AI coding tool. Read with `docs/RMS-PLAN.md` (the RMS feature/screen spec).
> **Status:** Architecture spec. **No code here** — this defines the target system.
> **Last updated:** 2026-06-22

---

## 0. Context & current state

- **IMS** = admin/back-office app (Next.js 14 App Router + TypeScript + Prisma + MySQL `kcrms` on AWS RDS). Multi-tenant by **branch** (`branch_id` on tenant-owned tables; branch-scoped RBAC roles).
- **RMS** = touch-screen kiosk layer, built as a **`/rms` route inside the same IMS app** (same repo, same DB, same deploy). One screen per **block**. See `docs/RMS-PLAN.md`.
- **Centers** = branches (e.g. KC Broadway, KC Bangalore, KC Luxe). Each center has blocks → racks → trays (the `location_nodes` tree) and physical product samples (`product_copies`).

### Current setup is NOT yet production-grade
Today: single server, single `pm2` process, **hand-run SQL migrations**, no monitoring/alerting, no read replica, secrets in plaintext. This is fine for dev but is the source of the recurring "table doesn't exist" outages. The sections below define what must change to run a live multi-center fleet. **§9 lists the concrete gaps to close.**

---

## 1. Target topology

```
                          CloudFront CDN  ──►  S3 (product images, static assets)
                                ▲
Screens / Browsers ──►  ALB / nginx  (HTTPS, WAF, rate-limiting)
                                │
                   ┌────────────┴────────────┐
                   │  App tier (≥2 instances) │  Next.js (IMS + /rms), STATELESS, Dockerized
                   └────────────┬────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
   RDS PRIMARY            RDS READ-REPLICA              Redis
   (IMS writes,           (RMS reads, analytics      (sessions, hot catalog cache,
    transactions)          rollup reads)              screen heartbeats, pub/sub,
                                                       recommendation cache, rate-limit)
```

Principles:
- **App tier stateless + ≥2 instances** behind a load balancer → no single point of failure, rolling/zero-downtime deploys.
- **RMS reads from a read-replica** — RMS is read-heavy, IMS write-heavy; isolate them so kiosk browsing never contends with admin writes.
- **Redis** for sessions, hot reads, heartbeats, pub/sub, and recommendation/cache serving.
- **CDN + S3** for all images — image-heavy RMS grids must not be served from the app tier.

---

## 2. Multi-tenancy (multi-center) — production model

**Keep shared-schema multi-tenancy** (one DB, one schema, `branch_id` on every tenant-owned row). Do **not** move to DB-per-center / schema-per-center — it multiplies migrations, backups, connections, and ops with no benefit at this scale.

Hardening required:
1. **Central tenant-scoping guard (non-negotiable).** Add a **Prisma middleware / repository layer** that always injects the session's allowed `branchId` into every tenant-scoped query. Page-by-page `where: { branchId }` is too leak-prone in production — one missed filter = cross-center data leak.
2. **Access rules:** HO = org-wide; branch users = their branch only; an RMS screen = its branch + its bound block's subtree only. Nothing crosses centers.
3. **Per-branch config** table (theme, business hours, screen defaults, feature flags) so each center is independently configurable.
4. **Cross-tenant leakage is the #1 multi-tenant failure mode** — design and test against it explicitly.

---

## 3. RMS fleet at production scale

- **Screen registry** = `screens` + `screen_devices` (single source of truth for every screen in every center).
- **Device activation + Screen Manager approval** (see RMS-PLAN §7) = the security boundary. Unapproved/revoked device → returns nothing. Screen management is **branch-scoped**: a Branch Admin creates a **Screen Manager** (`SCREEN_MANAGER` role) who binds screens and approves devices for that branch only (not HO Admin).
- **Heartbeat → real-time health:** each screen pings every 30–60s → `last_seen` in Redis → an **HO fleet dashboard** (online/offline per center) with **alerts** when a screen drops, so issues are caught before a shop reports them.
- **Offline-first PWA:** service worker caches last-synced data → a center's LAN/internet blip never blanks a screen.
- **OS/hardware fleet management:** Edge/Chrome kiosk mode runs the app; add an **MDM (ScaleFusion / Hexnode / Intune)** for remote reboot, update, and monitoring across centers — essential once the fleet is large and physically distributed.
- **Versioning/rollout:** web app auto-updates on deploy; use cache-busting + a service-worker update flow so all screens converge to the new build cleanly.
- **Scoping:** Screen → Block (`location_node`) → Branch. A screen only ever queries its block subtree (via `location_nodes.path`) + its branch catalog.

---

## 4. Analytics & screen-performance metrics

### 4.1 Pipeline (don't write every tap to the primary DB)
1. **Client batches events** → `POST /api/rms/events` (ingest endpoint).
2. Append to an **events store**: `rms_events` (partitioned by date/branch), append-only.
3. **Pre-aggregate** into hourly/daily **rollup tables** (per screen, per branch, org) via a scheduled job.
4. **Dashboards query the rollups, not raw events** (fast, cheap).
5. If volume ever explodes, swap ingest to a stream (Kinesis/Kafka) → warehouse. The batched-ingest design makes this swap painless; not needed initially.

### 4.2 Event model
`rms_events`: `id, screen_id, branch_id, session_id, event_type, entity_type, entity_id, query_text, created_at`
Event types: `session_start`, `category_open`, `brand_open`, `product_view`, `search`, `bom_add`, `locate_sample`, `idle_reset`.
**Dwell-time is interaction-based (no camera):** every event is timestamped, so dwell per screen/product = the time gap between consecutive interaction events; idle gaps and abandonment fall out of the same stream.

### 4.3 KPI matrix (per screen → rolled up per branch → org)
| Category | Metric | Why |
|---|---|---|
| Health | Uptime %, offline incidents, last-active | Is the screen working (from heartbeat) |
| Reach | Sessions/day, unique sessions | Usage volume |
| Engagement | **Dwell-time per screen/product**, avg session duration, interactions/session, drill-down depth | Exploring vs bouncing — all **interaction/click-based, no camera** |
| Content | Top categories / brands / products viewed | What's popular per block |
| Intent | "Locate Sample" clicks, BOM adds, BOM conversion (views→BOM) | Real buying interest |
| Gaps | Searches with **no result**, dead-end views | Catalog/stock gaps to fix |
| Abandonment | Idle-reset rate, exit step | Where customers give up |

### 4.4 Tooling
- In-house: rollup tables + dashboard pages (HO org + per-center compare; Branch = own screens; per-screen drill-down). BI via **Metabase/Grafana** on the rollups.
- Screen health → Grafana + alerting on heartbeats.
- Optional: self-hosted **PostHog/Matomo** for funnels/heatmaps without third-party data sharing.

---

## 5. Multi-brand product suggestions

**Precompute, don't compute-on-request.** A scheduled job builds a **`recommendations` table**; the kiosk serves from **Redis cache** for instant response.

Strategies (layered, simple-first — no ML needed initially):
1. **Rule-based:** *other brands in the same category*, *attribute-similar alternatives* (same material/finish/size), *more from this brand*. → this is the core "multi-brand proposing" for material selection.
2. **Popularity:** most-viewed, most-added-to-BOM (from analytics rollups).
3. **Co-occurrence:** "also viewed in the same session" (from `rms_events`).
4. **Sponsored/Featured:** business-controlled `is_sponsored` (brand) / `is_featured` (product) flags blended in.
5. **A/B test** strategies and measure lift (views→BOM) via analytics.
6. **ML** only later if data volume + ROI justify it.

---

## 6. Data model additions (additive to the one schema)
- **RMS core:** reuse `screens`; add `screen_devices` (activation), `bom_lists` + `bom_items` (cart), `brands.is_sponsored`, `brand_products.is_featured`. (See RMS-PLAN §6.)
- **Analytics:** `rms_events` (raw, partitioned) + rollup tables (`rms_daily_screen_stats`, `rms_daily_branch_stats`, etc.).
- **Recommendations:** `recommendations` (precomputed: `source_product_id`, `suggested_product_id`, `strategy`, `score`).
- **Tenancy:** `branch_settings` (per-branch config).
- **Heartbeat:** `last_seen` on `screen_devices` (or in Redis with periodic DB flush).

---

## 7. Security
- **Tenant isolation guard** (§2) — the primary control.
- **RMS device activation** + branch **Screen Manager** approval + unguessable per-screen token + signed device cookie (RMS-PLAN §7).
- **HTTPS** everywhere, **WAF**, **rate limiting** at the edge.
- **Secrets manager** (AWS Secrets Manager / SSM); **rotate the RDS password that leaked**; never commit/paste creds.
- **Audit log** on every master change/approval (already exists — keep).
- **Session management** with timeout (already added: `user_session_logs` + session-ping).

---

## 8. Reliability & operations
- **CI/CD:** automated build → test → **migrate** → deploy (blue-green / rolling). Replace manual `git pull && build && pm2 restart`.
- **Migrations:** move from hand-run SQL to a **gated, versioned migration pipeline** (Prisma Migrate or an automated runner) so DB and code never drift. *(Biggest current production risk.)*
- **Observability:** error tracking (Sentry), centralized logs, APM, uptime + heartbeat alerting.
- **Backups & DR:** automated RDS snapshots **with tested restores**; point-in-time recovery enabled.
- **Caching/scaling:** Redis hot cache, connection pooling for many polling screens, read-replica for RMS/analytics reads.

---

## 9. Gaps to close before "production" (checklist)
- [ ] Central tenant-scoping guard (Prisma middleware) — no query can omit `branch_id`.
- [ ] Migration pipeline (stop hand-running SQL; gate migrations in CI).
- [ ] ≥2 stateless app instances behind a load balancer (HA).
- [ ] RDS read-replica; RMS + analytics read from it.
- [ ] Redis (sessions, cache, heartbeats, recommendations).
- [ ] S3 + CloudFront for product images.
- [ ] Screen heartbeat + fleet dashboard + offline alerts.
- [ ] Analytics ingest + rollup tables + dashboards.
- [ ] Precomputed recommendations + cache.
- [ ] Monitoring/alerting (Sentry, logs, APM, uptime).
- [ ] Automated backups + tested restore.
- [ ] Secrets manager; **rotate leaked RDS password**.
- [ ] CI/CD with zero-downtime deploys.
- [ ] MDM for the screen hardware fleet (when fleet grows).

---

## 10. Build sequence (production, multi-center)
1. **Harden the core**: tenant-scoping guard, migration pipeline, secrets rotation, monitoring, backups.
2. **Infra**: containerize, ≥2 instances + LB, read-replica, Redis, S3/CDN.
3. **RMS app** (per RMS-PLAN milestones): shell → device activation/approval → home → flows → product detail → BOM.
4. **Fleet ops**: heartbeat + fleet dashboard + alerts; PWA offline; MDM.
5. **Analytics**: event ingest → rollups → dashboards.
6. **Recommendations**: precompute job → cache → serve on product detail; A/B test.
7. **Roll out across all centers** with the fleet dashboard giving full visibility.

---

## 11. Locked decisions (carried from RMS-PLAN)
- RMS = `/rms` route inside the IMS app; same repo, same `kcrms` DB, same deploy; free URL `/rms/screen/<token>`.
- Multi-tenancy = shared-schema + `branch_id` (centrally enforced).
- Branch Admin creates a branch-scoped **Screen Manager** (`SCREEN_MANAGER` role) who binds screen↔block and approves device activation for that branch (NOT HO Admin).
- RMS own colorful theme; follow Figma 1:1; **price hidden** everywhere.
- Reads (RMS/analytics) → read-replica; writes (IMS) → primary.

---

## 12. Future roadmap — Phase 2+ (enterprise level)

> Deliberately **out of current scope.** Listed so the architecture leaves room for them and nothing here is designed in a way that blocks them. Pick up as the business grows.

### 12.1 Identity & access (enterprise auth)
- **SSO** via SAML / OIDC (Google Workspace / Microsoft Entra ID) + **MFA/2FA**.
- **SCIM** auto user provisioning/deprovisioning.
- RBAC → **ABAC** (attribute/permission-based) with custom roles & a permission matrix.
- Tamper-evident, exportable **audit trail**.

### 12.2 Multi-tenancy & franchise scale
- Self-service **center/franchise onboarding**; per-tenant **white-labeling** (logo, theme, domain).
- **Data residency / region** selection; optional per-tenant encryption keys.
- Tenant-level feature flags & plans.

### 12.3 Internationalization — ✅ MOVED to current scope
- i18n (multi-language UI + kiosk), multi-currency, localization, RTL, per-center timezones — **now in the MVP** (see RMS-PLAN §12.2).

### 12.4 API platform & integrations
- Extract the **shared backend API** (NestJS) so IMS, RMS, mobile, and partner apps consume one API.
- **Public REST/GraphQL API** with API keys/OAuth + **webhooks** + an **event bus** (Kafka/EventBridge).
- Integrations: **ERP / accounting** (SAP, Tally), **CRM** (Salesforce/HubSpot), and your existing apps (WhatsApp backend, emailer, landing, material library, iOS/web) unified under one platform.

### 12.5 RMS / kiosk — enterprise features
- **BOM → quote → order → fulfillment** workflow (procurement, supplier portal, POs). *(Basic customer-ID + BOM-as-quote ✅ moved to current scope — see RMS-PLAN §12.1; the full order/procurement/fulfillment chain stays Phase 2.)*
- **Wayfinding / AR** "navigate me to the sample" using the location tree.
- **Signage-CMS hybrid** — schedule promo content on idle screens; **video-wall** sync for large displays.
- Robust **offline sync** with conflict resolution; **predictive maintenance** for screens.
- *(Accessibility (WCAG/ADA) + voice/assistant ✅ moved to current scope — see RMS-PLAN §12.3.)*

### 12.6 Analytics, BI & AI
- **Data warehouse** (Snowflake/BigQuery) + ETL/ELT; executive **BI dashboards**.
- **ML**: personalized recommendations, **demand forecasting**, stock optimization, anomaly detection.
- Privacy-aware **foot-traffic** analytics (camera/sensor) + heatmaps. *(Interaction/click-based dwell-time ✅ moved to current scope — see RMS-PLAN §12.4.)*

### 12.7 Inventory & business depth
- **Multi-warehouse transfers** between centers; stock reconciliation, **cycle counts**, **RFID**.
- **Pricing/discount engine** (if price is later introduced), returns/RMA.
- Supplier & procurement modules.

### 12.8 Mobile
- **Staff app** (scan, place, QC, manage on the go).
- **Customer app** (continue kiosk BOM, save favorites, book appointments).

### 12.9 Notifications platform
- Unified **multi-channel** notifications (email / SMS / **WhatsApp** / push) with templates, preferences, and delivery tracking — built on the existing WhatsApp/email assets.

### 12.10 Reliability, security & compliance (enterprise-grade)
- **Kubernetes + autoscaling**, multi-AZ, **multi-region** with failover; defined **RPO/RTO** DR.
- **GitOps + IaC** (Terraform); blue-green/canary; a real **feature-flag platform**.
- **Distributed tracing + SLOs**, incident/on-call management, load & **chaos testing**.
- Compliance: **SOC 2 / ISO 27001**, **GDPR / data-privacy** + consent, PII handling.
- **DDoS protection**, bot management, automated dependency/vulnerability scanning, scheduled pen-tests, automated secret rotation, immutable/ransomware-safe backups, field-level encryption + **KMS**.
