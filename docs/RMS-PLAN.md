# RMS Screen — Build Plan & Specification

> **Status:** Design finalized (Figma). Architecture decided. **No code written yet.**
> **Audience:** Any developer or AI coding tool picking this up. Read top-to-bottom before writing code.
> **Last updated:** 2026-06-22

---

## 1. What is RMS?

RMS (Retail/Rack Material Screen) is a **touch-screen kiosk** mounted physically on each **block** of a Knowledge Center branch. A visitor (customer or staff) discovers materials present in that block, drills down to a product, and sees its **exact physical location** (block → rack → tray) to go find the sample.

It is the Phase-2 "screen layer" from the IMS architecture doc. IMS is the existing admin/back-office app and owns all data. RMS is a **read-mostly front-end** on the same data, plus a few interactive features (BOM cart, view tracking).

**One screen = one block.** Each screen is bound to one BLOCK `location_node`. It shows that block's stock primarily, plus global browse across the branch.

---

## 2. Architecture decision (LOCKED)

**RMS is built INSIDE the existing IMS app as a `/rms` route — same repo, same deploy.**

- **Same Git repo** (`ims revisesd`) → one `git push`.
- **Same Next.js app** → RMS pages live under `src/app/rms/` (outside the `(app)` auth group, so no sidebar, no IMS login, its own kiosk theme).
- **Same database** (`kcrms` on AWS RDS), **same Prisma client** — RMS reads live IMS data directly, no separate schema, no API layer.
- **Same deploy** as IMS: `git pull → npm run build → pm2 restart`. No new server process, no nginx change.
- **URL is free:** `https://dev.knowledgecenter.store/rms/screen/<token>`.

### Why this over a separate repo / monorepo
A separate app (own folder/repo or `ims/ + rms/` monorepo) would mean: a second `package.json` + `node_modules`, a **second Prisma schema to keep in sync**, a second build, a second pm2 process, and **nginx config (subdomain/port) for the RMS URL**. For a small team that's pure overhead. Keeping RMS as a `/rms` route gives one repo, one push, one deploy, one schema, and a free URL — while route groups keep the code cleanly isolated. Extraction into a separate service is easy later (Phase-2 NestJS API) because RMS code is already siloed in `rms/` folders.

---

## 3. Folder structure (where everything goes)

```
ims revisesd/                         ← existing repo (root unchanged)
│
├── prisma/
│   ├── schema.prisma                 ← ONE schema; add RMS tables here
│   │                                    (screen_devices, bom_lists, bom_items,
│   │                                     + is_sponsored on brands, is_featured on
│   │                                       brand_products, a view counter)
│   └── migrations-manual/            ← RMS additive migration .sql files here
│                                       (same manual-migration pattern IMS uses)
├── docs/
│   └── RMS-PLAN.md                   ← this file
│
└── src/
    ├── app/
    │   ├── (app)/                    ← IMS pages (sidebar + login) — UNTOUCHED
    │   │   └── rms-screens/          ← NEW: Branch Admin + Screen Manager — bind screen↔block + approve devices (branch-scoped)
    │   ├── api/
    │   │   ├── ...(IMS)
    │   │   └── rms/                  ← NEW: RMS read + BOM + device endpoints
    │   └── rms/                      ← NEW: RMS kiosk app (own layout/theme, no sidebar/login)
    │       ├── layout.tsx            ← RMS purple/fullscreen kiosk theme
    │       ├── screen/[token]/page.tsx   ← kiosk entry: device check → Home for the block
    │       ├── category/             ← BBC flow
    │       ├── brand/                ← BBB / BBP flow
    │       └── product/[id]/         ← shared Product Attribute (detail) page
    ├── components/
    │   ├── ...(IMS)
    │   └── rms/                      ← NEW: all RMS components
    └── lib/
        ├── prisma.ts                 ← shared (RMS uses the same client)
        └── rms/                      ← NEW: RMS-only helpers (subtree query, etc.)
```

Rules:
- All RMS code lives in `rms/` folders (`app/rms`, `app/api/rms`, `components/rms`, `lib/rms`) + the admin under `app/(app)/rms-screens`. It never mixes into IMS pages/components.
- Shared = only infrastructure (Prisma, DB, a few utils). That is reuse, not duplication.

---

## 4. The Figma design is FINAL

- Build **exactly** to the Figma design (file "RMS-Sakshi"). Do not redesign layout, flow, or visual style.
- Data in Figma frames is **dummy/placeholder** — real content comes from the DB. Use the design for layout/structure/flow only.
- **Only intentional deviation: do NOT show price anywhere.** (No price field in DB; client chose to hide it.)
- There are **more screens/states than the exported screenshots** — always check the Figma file for the full set.
- **Theme:** RMS has its own **purple/colorful, image-heavy** theme. The IMS rules (greyscale/monochrome, no-emoji) do **NOT** apply to RMS — match Figma.

---

## 5. Screens & navigation flow

### 5.1 Home (per screen, tied to its block)
Top bar always shows the screen's physical position from its bound block: `3rd Floor | Block D | Rack 2`. Branch name shown. Offers:
- **Local — "What's in this Rack"**: stock in THIS screen's block (its subtree of racks/trays).
- **Global — 3 modes:** BBC (Browse By Category), BBB (Browse By Brand), BBP (Browse By Product).

### 5.2 BBC — Browse By Category
All categories → selected category/sub-category → **Product Attribute page** (shared detail).
Also links to an **Explore Brand page** (reused, "Same") with **View all Categories** + **View all Products**.

### 5.3 BBB — Browse By Brand
All categories → selected category/sub-category → **Brands of that category** → Products → **Product Attribute page**.

### 5.4 BBP — Browse By Product
Landing with: **Sponsored brands** (each → Brand Page = that brand's Categories + Featured Products) **+ Featured Products + "Most added to BOM" + "Most Viewed"**.

### 5.5 Product Attribute page (shared detail — reused by ALL flows)
Image gallery + thumbnails, **QR code**, name, brand, tags, spec tabs (from product attributes: material/finish/size/thickness…), **PHYSICAL LOCATION box** (`Block › Rack › Tray`) + **"Locate Sample"**, **"+ BOM"**, "More Samples From This Brand". **No price.**

### 5.6 Other states (build per Figma)
Empty / "no stock", loading, idle/screensaver, device "pending approval" screen (see §7).

---

## 6. Data model

### 6.1 Existing IMS tables RMS READS (already in `kcrms`)
- `location_nodes` — warehouse tree; a BLOCK + descendant racks/trays. `path` → whole subtree in one query. `is_screen_mountable`.
- `product_copies` — physical samples; `location_node_id`, `availability` (IN/OUT), `instance_code`, `qr_media_id`.
- `brand_products` — product master: `name`, `sku`, `brand_id`, `category_id`.
- `brands`, `categories`, `product_attribute_values` + `attributes`, `product_media`, `branches`.

**Core query (heart of RMS):** given block node `B`, take `B.path`, fetch all `product_copies` in B's subtree, join to `brand_products` → brand/category/attributes/media. Filter/group progressively per flow. No new data for read flows — only grouping.

### 6.2 NEW tables/fields (additive, in the same schema)
1. **`screens`** — already in schema (`branch_id`, `location_node_id`, `device_identifier`, `view_default`, `status`). Reuse for screen↔block binding.
2. **`screen_devices`** (NEW) — device activation: `id`, `screen_id`, `device_id`, `status` (pending|approved|revoked), `device_secret`, `user_agent`, `ip`, `requested_at`, `approved_by`, `approved_at`.
3. **`bom_lists` + `bom_items`** (NEW) — the "+ BOM" cart. Shape TBD (see Open Questions).
4. **`brands.is_sponsored`** (NEW flag) — for BBP sponsored brands.
5. **`brand_products.is_featured`** (NEW flag) — for featured products.
6. **View counter** (NEW) — `product_views` (or a counter column) for "Most Viewed", incremented on product detail open.
7. **"Most added to BOM"** — derived from BOM item counts.

All additive; use IMS's manual-migration pattern (`prisma/migrations-manual/*.sql` run via `prisma db execute`).

---

## 7. Security — screen identity & device activation

RMS is served from a public server, so the URL must NOT be openable by anyone (e.g. from home).

### 7.0 Who manages screens — roles
Screen management is **branch-scoped**, NOT done by HO Admin:
- **Branch Admin** creates a **Screen Manager** user for their branch (new branch-scoped role `SCREEN_MANAGER`).
- The **Screen Manager** manages **all screens of that one branch** — creating/binding screens to blocks and approving/revoking devices.
- HO Admin only retains org-wide visibility (can see all branches' screens), but day-to-day screen management is the branch's Screen Manager.
- Hierarchy: **HO Admin → (creates) Branch Admin → (creates) Screen Manager → (manages) that branch's screens.**

### 7.1 Screen ↔ Block matching
- The **Screen Manager** (branch-scoped) creates a `Screen` and binds it to a block in their branch (`Screen.location_node_id`).
- Each screen gets an **unguessable token** URL: `/rms/screen/<random-token>` (not a sequential id).
- The block's Windows display is set once (kiosk mode) to that URL. App reads Screen → bound block → shows that block's data; top bar (Floor/Block/Rack) comes from the block node's ancestor path.

### 7.2 Device activation with Screen Manager approval
1. Unactivated device opens the URL → shows **"Pending approval"**, creates a **device access request** for the branch's **Screen Manager** (screen/block, device id, user-agent, IP, time).
2. **Screen Manager** (or Branch Admin) reviews → **Approve / Reject**.
3. Approve → server issues a **signed long-lived cookie** (the activation) → device now shows data.
4. Any other/unapproved device → blocked ("Pending/Denied"), attempt logged.
5. Screen Manager can **Revoke** any time.

Net effect: only Screen-Manager-approved physical screens show data; anyone opening the link elsewhere → request goes to the branch's Screen Manager, nothing shown until approved. A Screen Manager only ever sees/approves screens of their own branch.

> Admin UI for binding + approval lives in IMS under `app/(app)/rms-screens`, accessible to **Branch Admin + Screen Manager** (scoped to their branch).

---

## 8. Deployment & kiosk setup

- **Deploy = same as IMS:** `cd ~/ims && git pull && npm run build && pm2 restart all`. No new process, no nginx change. (If RMS migrations were added, run them first via `prisma db execute`, then `prisma generate`.)
- **URL:** `https://dev.knowledgecenter.store/rms/screen/<token>`.
- **Windows touch device (one-time):** Edge/Chrome kiosk mode auto-start:
  `msedge --kiosk https://dev.knowledgecenter.store/rms/screen/<token> --edge-kiosk-type=fullscreen`
  or install as a **PWA** (manifest + service worker) for fullscreen + offline read-cache.
- **Offline:** service worker caches last-synced data so the screen never goes blank if LAN/internet drops.
- **Auto-refresh:** data revalidates every ~30–60s (polling). No websockets.

---

## 9. Suggested build order (milestones)

1. **RMS shell** — `app/rms/layout.tsx` (own theme), route group, base kiosk layout.
2. **Security first** — `SCREEN_MANAGER` role + `screens` binding admin (Branch Admin/Screen Manager) + `screen_devices` activation + approve/reject/revoke + "pending approval" screen. Nothing viewable without it.
3. **Home** — Local "What's in this Rack" + 3 global modes; location top bar from bound block.
4. **BBC** → **Product Attribute (detail) page** (shared) with location + QR + specs + "+ BOM".
5. **BBB** (category → brands → products → detail).
6. **BBP** (sponsored / featured / most-viewed / most-added-to-BOM) + Brand Page.
7. **BOM cart** end-to-end.
8. **PWA + offline + kiosk polish** (idle reset to home ~60s, fullscreen, branding, empty/loading states).

Build each screen exactly to Figma. Price stays hidden.

---

## 10. Open questions (decide while building)
1. **BOM shape** — per-screen (anonymous kiosk cart) or per-visitor? How retrieved later (print/email/QR)?
2. **Sponsored / Featured** — who sets these flags and in which IMS admin UI?
3. **Global vs local** — confirm: "What's in this Rack" = this block only; BBC/BBB/BBP = whole branch. (Current understanding: yes.)
4. **Static branch IP** — optional defense-in-depth (IP allowlist) on top of device activation, if the branch IP is static.

---

## 11. Decisions locked
- RMS = **`/rms` route inside the IMS app, same repo, same DB (`kcrms`), same deploy**.
- URL free: `/rms/screen/<token>`.
- Windows touch → Edge/Chrome kiosk mode (or PWA + offline cache).
- **Branch Admin** creates a **Screen Manager** (new branch-scoped `SCREEN_MANAGER` role) who manages all that branch's screens — binds screen↔block **and** approves device activation (request → approve/reject/revoke; unguessable token + signed device cookie). NOT HO Admin.
- Follow Figma **1:1**; **price hidden** everywhere (only deviation).
- Home = Local ("What's in this Rack") + Global 3 modes (BBC / BBB / BBP); shared Product Attribute (detail) page.
- RMS has its **own colorful theme** (IMS greyscale/no-emoji rules do not apply).
- New backend (additive in same schema): `screen_devices`, BOM tables, `is_sponsored`, `is_featured`, view counter.
- **In current scope (moved up from Phase 2):** customer ID + BOM-as-quote, i18n, accessibility/voice, interaction-based dwell-time analytics (see §12).

---

## 12. Added to current scope (moved up from Phase 2)
These were originally future items; the client wants them in the MVP build.

### 12.1 Customer identification + BOM as a quote
- At the kiosk, **optionally identify the customer** (loyalty/membership scan, or phone/lead capture).
- The **BOM cart is tied to that customer** (`bom_lists.customer_id`).
- **QR handoff:** the visitor scans a QR to **continue the same BOM on their phone**.
- BOM can be **emailed / pushed to CRM as a quote** (reuse the existing emailer / WhatsApp assets).
- New data: `customers` (or `leads`), `bom_lists.customer_id`, a quote record + email/CRM hook.
- Note: the quote lists **items + quantities only — no price** (per locked decision), unless price is later enabled.

### 12.2 Internationalization (i18n)
- **Multi-language UI + kiosk** (language switch), localization, **RTL** support, **per-center timezone**.
- **Multi-currency** support wired in (only meaningful once price is shown; price currently hidden).
- New: locale + timezone per branch/screen; translation resource files; locale-aware date/number formatting.

### 12.3 Accessibility
- **WCAG / ADA** compliant kiosk — sufficient contrast, visible focus, large touch targets, screen-reader labels/ARIA.
- **Voice / assistant** navigation option.
- Ties into i18n (multi-language voice + labels).

### 12.4 Dwell-time & interaction analytics (interaction-based — NOT camera)
- Engagement measured purely from **clicks/taps and interaction events** — privacy-friendly, no camera.
- **Dwell-time** = time spent per screen / product, derived from the time gap between interaction events; plus taps per session, drill-down depth, and idle gaps.
- Captured via the analytics event stream (see `ARCHITECTURE.md` §4) — every tap/view/search timestamped, dwell computed from consecutive event timestamps.
