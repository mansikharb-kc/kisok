# KC IMS — System Architecture & Database Schema (Phase 1)

> Production-level design for the Knowledge Center Inventory Management System.
> Built on the IMS Phase-1 BRD + PRD v0.6. Designed so the **RMS screen layer**
> ("which sample/product is in which rack of which docket") can be added later
> **without re-modelling the database** — the location tree and copy→location
> mapping already support it.

---

## 0. Design principles (yeh poore design ki neev hain)

1. **Trickle-down (3-layer):** HO (L1) defines masters → Branch Admin (L2) configures → Operators (L3) only *select* from controlled lists. Downstream kabhi master redefine nahi karta; naya chahiye to **change request → HO approval**.
2. **Shared master + local overlay:** ek `(Brand, SKU)` ka product **ek hi baar** define hota hai (shared `brand_products`), aur har seller/branch usko reference karke apna **local overlay** (copies, locations, QR) rakhta hai.
3. **Physical copy = scannable unit:** har physical sample ek `product_copy` (instance) hai — apna QR + instance code + location. Yahi cheez aage RMS screen pe dikhegi.
4. **Location tree = single source of "kya kahan hai":** arbitrary-depth nested hierarchy. Branch flow ko yahan simple rakhna hai: **warehouse → blocks → racks → tray → custom**. Screen layer isi tree ke kisi node se bind hoga; us node ke neeche jitne copies hain wahi us screen pe dikhenge. **Yahi RMS ka core hai aur abhi se ready hai.**
5. **Everything auditable:** har master change, approval, QC, placement audit log mein.

---

## 1. System Architecture

### 1.1 Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                                      │
│                                                                    │
│  ┌────────────────┐   ┌─────────────────┐   ┌──────────────────┐  │
│  │  IMS Web App   │   │ RMS Screen App  │   │ Concierge / BOM  │  │
│  │ (admin + ops)  │   │ (docket NUC,    │   │ apps (Phase 2)   │  │
│  │  Phase 1       │   │  kiosk, Phase 2)│   │                  │  │
│  └───────┬────────┘   └────────┬────────┘   └────────┬─────────┘  │
└──────────┼─────────────────────┼─────────────────────┼────────────┘
           │       (HTTPS / REST + JSON, JWT auth)      │
┌──────────┴─────────────────────┴─────────────────────┴────────────┐
│  APPLICATION LAYER  (one shared API for ALL client apps)          │
│                                                                    │
│  Auth & RBAC │ Master mgmt │ Onboarding │ Consignment/QC          │
│  Approval workflow │ QR generation │ Sticker render │ Notifications│
│  Location-tree service │ Screen-binding/query service             │
└──────────┬─────────────────────────────────┬─────────────────────┘
           │                                  │
┌──────────┴───────────┐         ┌────────────┴──────────────┐
│  AWS RDS MySQL 8.0   │         │  AWS S3 bucket             │
│  (transactional DB,  │         │  images, video, PDFs,      │
│   hierarchy, attrs)  │         │  rendered stickers + QR    │
└──────────────────────┘         └───────────────────────────┘
           │
┌──────────┴───────────┐
│  Redis (optional,    │  sessions, cache, job queue (sticker batch, notifications)
│  AWS ElastiCache)    │
└──────────────────────┘
```

### 1.2 Recommended stack (matches what dev site already uses)

| Concern | Choice | Why |
|---|---|---|
| Web frontend | **Next.js + TypeScript + Tailwind** | Already in use on dev site; SSR + good for kiosk screen later |
| Backend API | **Dedicated Node service (NestJS)** — *separate from Next* | Phase 2 ke RMS/Concierge/BOM apps **same API** consume karenge. Ek shared backend rakhna production ke liye sahi hai. |
| Database | **MySQL 8.0 on AWS RDS** | Recursive CTE (hierarchy), JSON type (flexible payloads), generated columns (one-Master-per-SKU). **MySQL 8.0+ zaroori** — 5.7 mein CTE/CHECK nahi. |
| ORM | **Prisma** or **Drizzle** | Type-safe, migrations, MySQL support |
| Object storage | **AWS S3** | Media DB mein nahi daalna; S3 bucket + signed URLs. (RDS aur S3 same AWS account/VPC mein.) |
| Auth | **JWT (access + refresh) + RBAC** | Role-scoped (role × branch) |
| QR | server-side QR lib | instance_code encode karta hai |
| Sticker render | **HTML template → PDF (Puppeteer)** | Category-wise template ko print-ready PDF banata hai |
| Async jobs | **BullMQ + Redis** | Batch sticker render, notifications |
| Deploy | **Docker containers** (local KC server ya cloud) | BRD: "run on local or cloud" |

> **Production note:** RMS screens (docket NUCs) LAN ke through central API se data lenge. Har NUC pe ek **local read-cache** rakhna (last-synced docket data) taaki internet/LAN down ho to screen blank na ho — yeh Phase 2 detail hai, par architecture ise support karta hai.

---

## 2. Database Schema

Notation: **PK** = primary key, **FK** = foreign key. Saari tables mein implicitly `id`, `created_at`, `updated_at`, `created_by`, `updated_by` maano (audit ke liye). Soft-delete ke liye `status` / `deleted_at`.

### 2.1 Identity & Access

```
users
  id (PK), full_name, email (unique), phone, password_hash,
  status (active/disabled), last_login_at

roles
  id (PK), code (unique), name
  -- seed (Phase 1 = 5 roles):
  -- HO_ADMIN, BRANCH_ADMIN, ONB_LEAD, CONSIGNMENT_USER, OB_EXEC
  -- (Phase 2: CONCIERGE, DESIGNER — abhi mat banao)

user_roles
  id (PK), user_id (FK→users), role_id (FK→roles),
  branch_id (FK→branches, nullable — HO_ADMIN ke liye null/global)
  -- ek user kai branch mein alag role le sakta hai
```

> **Gap fix:** dev site bolta hai "7 Roles" — Phase 1 mein sirf **5** chahiye. Concierge/Designer Phase 2 hain. Roles ko **seed data** rakho, hard-code mat karo, taaki Phase 2 mein add karna easy ho.

### 2.2 Branch & HO Masters (L1 — KC HO Admin)

```
branches
  id (PK), name, branch_code (KC DNA — unique, NOT human-facing),
  status
  -- Phase 1: ek hi row = KC_One. Schema 1..n support karta hai.

categories
  id (PK), name, code (unique), parent_id (FK→categories, nullable),
  status
  -- self-referencing taaki sub-categories ban sakein

attributes
  id (PK), name, code (unique),
  data_type (text | number | enum | boolean | date | file),
  unit (nullable, e.g. 'mm'), is_required, status

attribute_options          -- sirf enum-type attributes ke liye
  id (PK), attribute_id (FK→attributes), value, display_order

category_attributes        -- ATTRIBUTE ↔ CATEGORY binding (BRD: attribute is meaningless without category)
  id (PK), category_id (FK→categories), attribute_id (FK→attributes),
  display_order, is_required_override

brands
  id (PK), name, code (unique), logo_media_id (FK→media, nullable),
  approval_status (draft | approved | rejected), status

programs
  id (PK), name, code (unique), status
  -- program koi naya attribute source nahi banata; existing attributes ko
  -- 2 buckets mein group karta hai: definition (contract terms) + common (shared fields)

program_definition_attributes   -- per-SELLER contract terms (tenure, fit-out, contract period)
  id (PK), program_id (FK→programs), attribute_id (FK→attributes)
  -- ya fixed columns; attribute-driven rakhna zyada flexible

program_common_attributes        -- product-level fields shared by ALL products in the program
  id (PK), program_id (FK→programs), attribute_id (FK→attributes)

sticker_templates                -- CATEGORY-WISE template (HO defines, branches inherit)
  id (PK), category_id (FK→categories),
  layout (JSON — positions/sizes),
  elements (JSON — which of: brand_logo, branch_name, product_name,
            category, selected_attributes[], location_id, sku, qr),
  status
  -- branch_name slot render-time pe auto-fill hota hai (no per-branch redesign)
```

### 2.3 Branch Configuration (L2 — KC Branch Admin)

```
branch_programs            -- branch selects an HO program; HO APPROVAL loop
  id (PK), branch_id (FK), program_id (FK),
  approval_status (pending | approved | rejected)

branch_brands              -- "Add Brands" to a branch
  id (PK), branch_id (FK), brand_id (FK)

location_nodes             -- ⭐ THE WAREHOUSE TREE (arbitrary depth) — RMS ka core bhi
  id (PK),
  branch_id (FK→branches),
  parent_id (FK→location_nodes, nullable — root = warehouse),
  node_type (WAREHOUSE | BLOCK | RACK | TRAY | CUSTOM),
  name,
  code,
  path (materialized path, e.g. '/12/45/78/' — fast subtree queries),
  depth (int),
  is_placement_eligible (bool — kya yahan copy rakh sakte hain, e.g. RACK/TRAY),
  location_id (generated unique address — sirf placement-eligible nodes pe),
  is_screen_mountable (bool — kya yahan screen lag sakti hai, e.g. BLOCK),
  status

sample_sizes               -- controlled list; Onboarding Lead self-serve add kar sakta hai
  id (PK), branch_id (FK), label (e.g. 'A4', '300x300mm'),
  dimensions (nullable), created_by
```

> **Yeh table hi RMS ko enable karta hai.** `node_type` flexible hai — Branch Admin chahe to `Warehouse → Block → Rack → Tray → Custom` bana de. `is_screen_mountable` se hum jaanenge kaunsa node screen ke liye hai, `is_placement_eligible` se kaunse node pe sample rakhna allowed hai. `path` column se "is block ke neeche sab kuch" ek query mein nikal aata hai.

### 2.4 Sellers & Assignment (L3 — Onboarding Lead)

```
sellers
  id (PK), branch_id (FK), name, seller_code (unique),
  membership_id (unique), status

seller_brands              -- seller deals in 1..n brands
  id (PK), seller_id (FK), brand_id (FK)

seller_contracts           -- contract verification against program definition attrs
  id (PK), seller_id (FK), program_id (FK),
  collaboration_tenure, fitout_period, contract_start, contract_end,
  verified (bool), verified_by, remarks

seller_assignments         -- seller → OB Exec (exec sirf apne assigned sellers dekhta hai)
  id (PK), seller_id (FK), ob_exec_user_id (FK→users),
  assigned_by, assigned_at
```

### 2.5 Consignment & QC (L3 — Consignment User)

> Flow: OB Exec triggers → Consignment receives → buffer zone → fabricate (if needed) → QC → back to OB Exec.

```
consignments
  id (PK), seller_id (FK), brand_id (FK),
  initiated_by (FK→users, the OB Exec),
  spoc_name, spoc_contact, expected_date, remarks,
  status (initiated | received | in_buffer | fabricating | qc | passed_back | closed)

consignment_items
  id (PK), consignment_id (FK), description,
  expected_qty, received_qty,
  sample_type, status

qc_records
  id (PK), consignment_item_id (FK),
  result (pass | flag | repair | fabricate),
  notes, qc_by (FK→users), qc_at
  -- 'repair'/'fabricate' → item fabrication ko loop back ho sakta hai
```

> Note: BRD ke right-side "Concierge / Issuance-Retrieval" module Phase 1 mein **nahi** hai. Consignment flow yahan hai (Store + QC). Consignment User ka **alag role/login** hona chahiye (confirm pending tha — schema isे support karta hai).

### 2.6 Product Master & Onboarding (L3 — OB Exec)

```
brand_products            -- ⭐ SHARED BRAND PRODUCT MASTER (intrinsic data)
  id (PK), brand_id (FK), sku,
  name, category_id (FK→categories), status, created_by
  UNIQUE (brand_id, sku)        -- match key = (Brand, SKU)

product_attribute_values  -- master attribute values (EAV — queryable)
  id (PK), brand_product_id (FK), attribute_id (FK),
  value_text, value_number, value_bool, value_date, option_id (FK→attribute_options)
  UNIQUE (brand_product_id, attribute_id)

media                     -- generic media table (object-storage URLs only)
  id (PK), type (image | video | ecat_pdf | datasheet_pdf | logo | qr | sticker),
  url, mime, size_bytes, uploaded_by

product_media             -- master media (manufacturer images/video/PDFs)
  id (PK), brand_product_id (FK), media_id (FK→media), is_primary, display_order

local_onboarding_records  -- ⭐ LOCAL OVERLAY: (seller × branch × program) → references master
  id (PK), brand_product_id (FK), seller_id (FK), branch_id (FK),
  program_id (FK), status, onboarded_by

local_overrides           -- per-field DISPLAY override (e.g., local hero image) — master ko touch nahi karta
  id (PK), local_record_id (FK), attribute_id (FK, nullable),
  override_media_id (FK→media, nullable), override_value (nullable)

local_media               -- local sample photos, QC/onboarding notes media
  id (PK), local_record_id (FK), media_id (FK→media), note
```

> **Edit governance (PRD §5.2) enforce kaise hoga:**
> - New `(brand_id, sku)` create → koi bhi OB Exec, **no approval**.
> - Empty field bharna / extra media add → **free** (augment).
> - Already-filled master field modify/remove → **change_request (EDIT_MASTER_FIELD) → HO approval**.
> - Local overlay / overrides → hamesha free.
> Approved master change automatically saare referencing `local_onboarding_records` pe propagate (except locally-overridden fields).

### 2.7 Physical Copies / Instances (scannable units)

```
product_copies            -- ⭐ ek physical sample = ek row = ek QR
  id (PK),
  local_record_id (FK→local_onboarding_records),
  brand_product_id (FK→brand_products),   -- denormalized for fast lookups
  branch_id (FK→branches),
  sequence_no (int),
  instance_code (unique — = sellerSKU + branch_code + sequence; NOT human-readable),
  copy_role (MASTER | SLAVE),
  sample_size_id (FK→sample_sizes),
  location_node_id (FK→location_nodes, must be is_placement_eligible),
  qr_media_id (FK→media, nullable),
  availability (IN | OUT),        -- Phase 2 concierge toggle; default IN
  status
  -- CONSTRAINT: exactly ONE copy_role=MASTER per (brand_product_id, branch_id)
  --   (partial unique index)

stickers                  -- generated per copy from the category template
  id (PK), product_copy_id (FK), template_id (FK→sticker_templates),
  rendered_media_id (FK→media, the PDF/PNG),
  printed_at (nullable), status
```

**One-Master-per-SKU constraint (MySQL 8.0):**
MySQL mein partial/filtered unique index nahi hota, to **generated column** ka trick use karte hain. NULL values unique index mein "equal" nahi mani jaatin — isliye kai SLAVE (NULL) allowed, par sirf ek MASTER (1) per `(brand_product_id, branch_id)`:
```sql
ALTER TABLE product_copies
  ADD COLUMN is_master_flag TINYINT
    GENERATED ALWAYS AS (CASE WHEN copy_role = 'MASTER' THEN 1 ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_one_master (brand_product_id, branch_id, is_master_flag);
```

### 2.8 Approvals & Audit (Module H)

```
change_requests
  id (PK),
  type (NEW_CATEGORY | NEW_ATTRIBUTE | NEW_PRODUCT_TYPE |
        EDIT_MASTER_FIELD | BRANCH_PROGRAM | OTHER),
  payload (JSON — proposed change),
  branch_id (FK, nullable),
  requested_by (FK→users),
  status (pending | approved | rejected),
  decided_by (FK→users, nullable), decided_at, reason

audit_log
  id (PK), actor_user_id (FK→users), action, entity_type, entity_id,
  before (JSON), after (JSON), at

notifications
  id (PK), user_id (FK→users), type, payload (JSON),
  read_at (nullable), created_at
  -- consignment alerts, approval outcomes
```

### 2.9 RMS Readiness — Screen Binding (Phase 2, schema ready NOW)

```
screens                   -- ek docket/face NUC screen
  id (PK), branch_id (FK),
  location_node_id (FK→location_nodes, must be is_screen_mountable — e.g. a DOCKET/FACE),
  device_identifier (IP / MAC / token),
  view_default (LOCAL | GLOBAL),
  status
```

**"Is docket ke is rack mein kya hai" — yeh ban't ek alag feature, bas ek query:**

```sql
-- screen ek docket-node pe bind hai (say node id = 78, path '/12/45/78/')
-- us docket ke neeche saare placed copies, rack-wise grouped:

SELECT  rack.name              AS rack_name,
        bp.name                AS product_name,
        bp.sku,
        pc.instance_code,
        pc.availability
FROM    screens s
JOIN    location_nodes docket ON docket.id = s.location_node_id
JOIN    location_nodes rack   ON rack.path LIKE docket.path || '%'   -- subtree
JOIN    product_copies pc     ON pc.location_node_id = rack.id
JOIN    brand_products bp      ON bp.id = pc.brand_product_id
WHERE   s.id = :screen_id
ORDER BY rack.name;
```

Isi se RMS "Local View" ban jaata hai. "Global View" = `WHERE pc.branch_id = :branch` (poora warehouse). Matlab **screen layer ke liye DB mein kuch naya nahi banana** — bas ek read API aur kiosk UI Phase 2 mein.

---

## 3. Schema map (kaun-si table kis BRD module se)

| BRD / PRD module | Tables |
|---|---|
| HO Masters (A) | categories, attributes, attribute_options, category_attributes, brands, programs, program_*_attributes, sticker_templates, branches |
| Warehouse setup (B) | location_nodes, branch_programs, sample_sizes |
| Seller & assignment (C) | sellers, seller_brands, seller_contracts, seller_assignments, branch_brands |
| Consignment & QC (D) | consignments, consignment_items, qc_records |
| Product onboarding (E) | brand_products, product_attribute_values, product_media, media, local_onboarding_records, local_overrides, local_media |
| Copies + placement (E6) | product_copies |
| Labeling (F) | sticker_templates, stickers |
| Approvals (H) | change_requests, audit_log, notifications |
| Access | users, roles, user_roles |
| **RMS readiness (G, Phase 2)** | screens (+ existing location_nodes & product_copies) |

---

## 4. Build order (Phase 1, code baad mein — yeh sirf sequence hai)

1. **Foundation:** users/roles/auth + branches + audit_log
2. **HO masters:** categories → attributes → category binding → brands → programs → sticker templates
3. **Approval engine:** change_requests + notifications (masters ke saath hi chahiye)
4. **Branch config:** location_nodes (tree builder) + branch_programs + branch_brands + sample_sizes
5. **Sellers:** sellers + brands link + contracts + assignment to OB Exec
6. **Consignment & QC:** consignments → items → qc_records
7. **Product onboarding:** brand_products (shared) + attribute values + media + local overlay
8. **Placement:** product_copies (copies, master/slave, size, location) + instance code + QR
9. **Stickers:** template render → per-copy PDF → print
10. *(Phase 2)* screens + scan resolver + concierge/BOM apps

---

## 5. Open items jo design ko affect karte hain (confirm needed)

1. **Sticker physical spec** — size, printer type (template layout abhi flexible JSON rakha hai, render Phase me lock hoga).
2. **Consignment User** alag login? (schema yes maan ke chala hai)
3. **Auth provider** — apna email/password (yahi maana) ya koi SSO?
4. **Notifications channel** — in-app (default) ya email/WhatsApp bhi Phase 1 mein?
5. **Deployment target** — local KC server ya cloud (architecture dono support karta hai)?
```

