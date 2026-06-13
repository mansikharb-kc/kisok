# PRD — Knowledge Center: Onboarding & Inventory Management System (IMSRMS)

| Field | Value |
|---|---|
| Product | Knowledge Center (KC) Onboarding & Inventory Management System |
| Internal code | IMSRMS |
| Status | **Draft v0.6** — L2 role renamed Brand Admin → Branch Admin (§11); QR scan-resolution & ML integration scoped to Phase 2 with a glimpse (§9.1) |
| Date | 2026-06-11 |
| Owner | Material Library (info@materiallibrary.org) |

> **How to read this draft:** Sections marked **[ASSUMPTION]** are my best guess where the brief was ambiguous — confirm or correct them. Section 10 lists the **Open Questions** that most affect the design. Nothing here is final; the goal is to give us a shared skeleton to argue over.

---

## 1. Background & Vision

The Knowledge Center (KC) is a physical materials/sample library. **Sellers (brands)** consign physical product samples to a KC branch, where they are catalogued, quality-checked, and placed at specific physical **locations** (warehouse → area → shelf). Visitors, concierges, and designers then discover, scan, issue/retrieve, and add those samples to project BOMs.

IMSRMS is the operating system for that lifecycle: from **head-office master setup**, through **seller onboarding and consignment QC**, to **product cataloguing, physical placement, and QR-driven retrieval/BOM** workflows.

The system is built on a **three-layer, trickle-down model**: definitions made once at the top (Head Office) constrain and pre-populate everything below, so operators downstream select from controlled lists rather than re-defining structure.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **KC** | Knowledge Center (a physical branch; first instance = `KC_One`) |
| **HO** | Head Office (global/central administration) |
| **ML** | Material Library — external source system products are fetched from **[ASSUMPTION]** |
| **Program** | A consignment/collaboration scheme a seller participates in (defines contract terms + common product rules) |
| **Brand** | HO master record for a label; owns a reusable, SKU-keyed **product catalog** shared across sellers & KCs |
| **Seller** | The contract/collaboration party (Seller ID, Membership ID); deals in **1..n brands** |
| **Branch code (KC DNA)** | Per-branch code **annexed** to the SKU to form the instance code; **not human-readable** — stored/used when listing the product & encoded in the QR |
| **Master / Slave copy** | Designation on copies of the same SKU: exactly **one Master** per SKU (reference, often larger), others **Slaves** (size from a controlled list) |
| **Sticker template** | A category-wise label layout configured at HO and inherited by every branch (KC name auto-fills a default slot) |
| **Buffer zone** | Physical staging area where received samples wait before fabrication/QC |
| **Location ID** | A unique address for a physical placement, derived from the nested warehouse hierarchy |
| **Consignment** | A physical shipment of samples from a seller, received and QC'd before onboarding |
| **SPOC** | Single Point of Contact (seller-side contact for a consignment) |
| **QC** | Quality Control |
| **BOM** | Bill of Materials — a designer's project cart of materials (external "Material KC BOM App") |
| **Concierge** | On-floor staff who issue/retrieve physical samples for visitors |
| **SKU** | Stock Keeping Unit — per-product identifier |

---

## 3. Goals, Non-Goals, Success Metrics

### 3.1 Goals
- Single source of truth for KC master data (categories, attributes, brands, branches, programs).
- Enforce trickle-down: downstream roles **select**, they do not **redefine**.
- Streamline seller onboarding: contract verification → membership → assignment → consignment QC → product onboarding → physical placement.
- Every placed sample carries a **QR + infographic label** that drives three context-aware actions (view, issue/retrieve, add-to-BOM).
- Controlled change: any downstream addition (new attribute/category/etc.) routes through an **HO approval** workflow.

### 3.2 Non-Goals (for v1) **[ASSUMPTION — confirm]**
- Building the external **Material KC BOM App** and **Concierge App** themselves (IMSRMS exposes APIs/scan endpoints they consume).
- E-commerce / payments.
- Multi-branch rollout beyond `KC_One` (architecture must *support* 1..n branches, but only `KC_One` goes live first).

### 3.3 Candidate Success Metrics
- Time from "seller contract signed" → "first product live on shelf with QR".
- % of consignment samples passing QC on first pass.
- Scan-to-action success rate (view / issue / BOM-add).
- # of HO approval cycles per onboarding (lower = cleaner masters).

---

## 4. Roles & Permission Layers

The system has **three definition layers** plus an **operations tier**:

| Layer | Role | Scope | Cadence |
|---|---|---|---|
| **L1 — Define globally** | **KC HO Admin** | All branches | One-time setup, editable forever |
| **L2 — Configure per branch** | **KC Branch Admin** | A KC branch | One-time per program, editable |
| **L3 — Operate** | **Onboarding Lead** | A KC branch | Ongoing |
| L3 — Operate | **Consignment User** | Receiving/QC | Ongoing |
| L3 — Operate | **Onboarding Exec** | Assigned sellers | Ongoing |
| Consumer | **Concierge** (app) | Floor | Ongoing |
| Consumer | **Designer/Visitor** (BOM app / public scan) | Floor/remote | Ongoing |

> **Trickle-down principle:** L1 outputs (categories, attributes, brands, programs, branches) become the **selectable options** for L2; L2 outputs (location IDs) become selectable for L3; L3 outputs (products, placements) become the **scannable inventory** for consumers.

---

## 5. Core Entities & Relationships (Data Model — conceptual)

```
KC Branch (1..n; KC_One)   — each branch carries a branch code (KC DNA)
 └─ Warehouse (1..n)            ← created by Branch Admin per program
     └─ Area (1..n)
         └─ Shelf / sub-level (1..n)   ← nesting is arbitrary depth, user-defined
             └─ Location ID (unique address)

Category (master, HO)
 └─ Product Attribute (master, HO)   ← attributes are bound to categories

Brand (master, HO)
 └─ Product (brand-scoped, SKU-keyed)        ← SHARED catalog
     ├─ Attributes (category + program-common), media, e-catalogue & datasheet PDF
     └─ defined ONCE per SKU; auto-reused on SKU match across sellers & KCs

Seller (contract party; Seller ID, Membership ID)
 └─ deals in Brands (1..n)                    ← single-brand today, multi-brand dealer supported

Program (master, HO)
 ├─ Program-definition attributes (per seller: collaboration tenure, fit-out period, contract period)
 └─ Common product attributes (apply to all products in the program)

Consignment (per seller shipment)
 └─ Sample item → QC status (pass / flag / repair / fabricate)

Copy / Instance  ← the physical, scannable unit (one per sample); gets a QR
 = Product(SKU) × Location ID
 ├─ KC instance code = seller SKU + branch code + sequence   (unique per copy; not human-readable)
 ├─ Master | Slave flag   (exactly ONE Master per SKU; rest Slaves)
 ├─ sample size   (from a controlled list; Onboarding Lead can extend it)
 └─ availability state (in / out)             ← concierge toggles on scan
```

**Key cardinalities / rules**
- A **Seller** is the contract party and deals in **1..n Brands** (single-brand seller today; multi-brand dealers supported).
- A **Brand** owns a **SKU-keyed product catalog**. A product is defined **once per SKU**; on a matching SKU it is **auto-reused** by other sellers carrying that brand and by other KC branches — no re-entry. **(model & governance: §5.1–§5.2)**
- A **Category** owns a set of **Attributes** (HO-defined). A product in that category inherits those attribute fields.
- A **Program** carries (a) seller-level contract attributes and (b) product-level common attributes that overlay every product in the program.
- **Location IDs** belong to a branch and are reusable across the branch once created.
- Each physical sample is a **Copy/Instance** with its **own QR**. Copies of the same SKU share identical infographic/product details (only the **Location ID** may differ). Exactly **one Master per SKU** (within a branch); all other copies are **Slaves**. Sample size is chosen from a **controlled list**.
- The QR/instance code **annexes the branch code (KC DNA)** to the SKU, so any scan reveals the originating branch and resolves to the product for BOM-add. The branch code is **not human-readable** (used in listings/QR, not printed prominently).

### 5.1 Product data: intrinsic (shared master) vs. contextual (local overlay)

A product is stored as a **Brand Product Master** (one per `(Brand, SKU)`, shared across all sellers & KCs) plus a **Local Onboarding Record** per `(Seller × KC × Program)` that references it.

| Field | Layer | Who edits |
|---|---|---|
| Product name | Master (intrinsic) | create/augment: any exec · modify: HO approval |
| Category | Master | create: any exec · modify: HO approval |
| Attribute values (spec, material, finish, dimensions…) | Master | create/augment: any exec · modify: HO approval |
| E-catalogue PDF, datasheet PDF | Master | add new: any exec · replace existing: HO approval |
| Manufacturer images / video | Master | add: any exec · remove/replace: HO approval |
| Program link | Local | exec (free) |
| # copies; per copy: Master/Slave (1 Master/SKU), sample size (controlled list), Location ID, instance code, QR, availability | Local | exec (free) |
| Local sample photos, QC/onboarding notes | Local | exec (free) |
| Per-field display override (e.g., local hero image) | Local | exec (free) — never alters the master |

### 5.2 SKU reuse & edit governance (resolved)

- **Match key = `(Brand, SKU)`.** SKU is unique within a brand, so reuse triggers only when the brand matches.
- **First create is open.** Any Onboarding Exec can create the Brand Product Master for a new `(Brand, SKU)` — no approval.
- **Augmenting is open.** Adding information that doesn't yet exist (filling an empty field, attaching an additional document/image) is free — it can't harm existing consumers.
- **Modifying existing data is gated.** Changing or removing a value already populated on the shared master routes to **HO approval** (Module H), because it changes what every other seller/KC reusing that SKU sees.
- **Local overlay is always free.** Contextual fields and per-field display overrides are edited locally and never touch the master.
- **Propagation.** Approved master changes propagate automatically to all referencing local records (except locally overridden display fields).

---

## 6. Functional Requirements by Module

### Module A — HO Master Data Management (KC HO Admin) — L1
- **A1. Category Master:** create/edit/retire categories.
- **A2. Attribute Master:** create attributes and **bind them to categories** (an attribute is meaningless without its category association). Define attribute type (text, number, enum, file, etc.) **[ASSUMPTION]**.
- **A3. Brand Master:** central brand management. Each brand owns a **SKU-keyed product catalog that is shared/reusable** across all sellers carrying the brand and across KC branches (define once per SKU, auto-reuse on match).
- **A4. Branch Management:** create KC branches 1..n (live: `KC_One`).
- **A5. Program Management:** create programs (one-time, editable). Each program defines:
  - **Program-definition attribute set** (per-seller terms): collaboration tenure, fit-out period, contract period, … 
  - **Common product attribute set**: fields shared by all products onboarded under the program.
- **A6. Approvals inbox:** review and approve/reject downstream change requests (new attribute, new category value, new product type, etc.) — see Module H.
- **A7. Sticker Template Configurator:** define a **category-wise** label template (layout + which elements appear) — see Module F. Published to all branches; the **KC/branch name auto-fills** a default slot per branch.

### Module B — Warehouse & Location Setup (KC Branch Admin) — L2
- **B1.** Select a Program (from HO list).
- **B2.** Build the **warehouse structure** for that program as an **arbitrary-depth nested hierarchy** (warehouse → area → shelf → …), adding nodes 1..n.
- **B3.** System **generates unique Location IDs** for placement-eligible nodes; these become branch-wide reusable addresses.
- **B4.** One-time per program, but fully editable/manageable later.
- **B5. Deletion guardrail:** a warehouse node **cannot be deleted while any copy still sits under it** — all copies must be **relocated first**. (Moving copies updates their Location ID → triggers re-labeling; see Module F.)

### Module C — Seller & Assignment Management (Onboarding Lead) — L3
- **C1.** Create **Seller** (the contract party) → assign **Seller ID**; link the **1..n Brands** the seller deals in (single brand today; multi-brand dealers supported).
- **C2.** Verify **contract / collaboration details** (against the program's definition attributes).
- **C3.** Assign **Membership ID**.
- **C4.** **Assign sellers to Onboarding Execs** (an exec gets access only to their assigned sellers/brands).
- **C5.** Notify **Consignment User** about incoming consignments.
- **C6. Sample-size list:** maintain the **controlled list of sample sizes**; the Onboarding Lead can **add new sizes** (self-serve, no HO approval). Execs select copy sizes from this list.

### Module D — Consignment & QC (Consignment User) — intermediary L3
> Flow: **OB Exec → Consignment → talk to brand & receive in → buffer zone → fabricate (if needed) → QC → back to OB Exec → onboard onto warehouse.**
- **D1. Trigger:** Onboarding Exec initiates the consignment and notifies the **Consignment User** — includes expected samples, remarks, and seller **SPOC** contact.
- **D2. Talk to brand & receive:** coordinate with the seller/SPOC and **receive the samples in** against the consignment.
- **D3. Buffer zone:** received samples are staged in the **buffer zone** pending preparation.
- **D4. Fabricate (if necessary):** cut/prepare/repair the sample to library spec.
- **D5. QC:** perform quality control; **flag** issues; loop back to fabrication if needed.
- **D6. Hand off to Onboarding Exec:** QC-passed (fit) samples are pushed back to the **Onboarding Exec**, who onboards them onto the warehouse (Module E).

### Module E — Product Onboarding & Placement (Onboarding Exec) — L3
- **E1.** Log in → see assigned sellers → open a **Seller's dashboard**.
- **E2.** Open **Program Management** for that seller/brand → select a Program.
- **E3.** **Assign Categories** to the program *first* (gates what can be onboarded).
- **E4.** Within a Category, two paths: **Product** and **Location**.
- **E5. Product path (define products first):**
  - Open the category → **add products**; attribute fields are **fetched from the HO Attribute Master** for that category (+ program-common attributes).
  - Enter the **seller-provided SKU**. If the SKU **already exists for that brand** (any seller, any KC), the system **auto-loads the shared Brand Product Master** (attributes, media, datasheet) — no re-entry. The exec may **add missing info freely**; **changing already-populated shared fields raises an HO edit-approval** (see §5.2).
  - If new: any exec can **create the master** (no approval) — enter product details (input or fetched from **ML**) and attach media — **images, video, e-catalogue PDF, datasheet PDF**.
  - If a needed attribute/category/product-type doesn't exist → **raise change request to HO** (Module H); cannot self-create masters.
- **E6. Location path (map products to physical space):**
  - Open the **allocated locations table** (from Branch Admin's location IDs).
  - Drill: select **Warehouse → Area → Shelf** → target **Location ID**.
  - **Select products from the product pool** and **map** them to the location.
  - Enter **number of copies**; the system materializes each copy as an **individual instance** (own QR + instance code = **seller SKU + branch code + sequence**).
  - Designate exactly **one Master** for the SKU; the rest are **Slaves**. Pick each copy's **sample size from the controlled list** (Onboarding Lead can extend it — §C6).
- **E7.** Trigger **sticker generation** (per-copy QR label rendered from the category template) for placements — Module F.

### Module F — Labeling: Sticker Template & Generation
> **Configured at HO (L1), rendered downstream (L3).**
- **F1. Template configurator (HO):** HO builds a **category-wise sticker template** — layout + which elements appear. Available elements: **brand logo, KC/branch name, product name, category, selected attribute(s), Location ID, SKU, QR code**.
- **F2. Inheritance:** the template is published to **every branch**; the **KC/branch name auto-fills** its default slot per branch (no per-branch re-design).
- **F3. Per-copy render:** at print time the template renders one sticker **per copy/instance** with that copy's data. Copies of the same SKU share identical content except the **Location ID** (which differs per copy).
- **F4. QR payload:** the QR encodes the **instance code = SKU + branch code + sequence** (not human-readable). It is **printed in Phase 1**; its **scan-resolution behaviors are Phase 2** (Module G / §9.1).
- **F5. Print-ready output**, batchable across a placement's copies (physical sticker dimensions / printer spec — **[Q10.2-1]**).

### Module G — Scan Behaviors & Integrations **(Phase 2 — glimpse §9.1)**
The **same QR** resolves to different actions depending on the scanning context (app/role):

| Scanner context | Action |
|---|---|
| **G1. Generic scan** (public/visitor) | Open the **product detail page** |
| **G2. Concierge App** | **Issue / Retrieve** = toggle the copy's **availability (out/in)** for **in-floor handling**; no borrower record, no due dates (per decision) |
| **G3. Material KC BOM App** | **Add the product to the active project's cart/BOM** in that app |

- **G4. ML integration (Phase 2):** fetch product master data into onboarding (Module E5) — glimpse §9.1.
- **G5.** Public product-detail page must render the catalogued attributes + media.

### Module H — Change Requests & HO Approvals
- **H1.** Any downstream role needing a new master value (attribute, category, product type, etc.) submits a **change request**.
- **H1b.** Modifying an **already-populated field on a shared Brand Product Master** submits an **edit-approval** request. (Creating a master or adding to empty fields needs no approval — see §5.2.)
- **H2.** Request lands in **HO Admin approvals inbox** (A6).
- **H3.** On approval, the master is updated and becomes available downstream; on rejection, requester is notified with reason.
- **H4.** Audit trail of who requested/approved what, when.

---

## 7. End-to-End Happy Path

1. **HO Admin** sets up categories, attributes, brand master, `KC_One` branch, a **Program** (contract + common-product attributes), and **category-wise sticker templates**.
2. **Branch Admin** picks the Program and builds the **warehouse hierarchy** → Location IDs generated.
3. **Onboarding Lead** creates a **Seller** (from a brand), verifies contract, assigns **Membership ID**, and assigns the seller to an **Onboarding Exec**. Notifies Consignment.
4. **OB Exec triggers consignment** → **Consignment User** talks to the brand, **receives samples in → buffer zone → fabricates (if needed) → QC**, then hands fit samples back to the Exec.
5. **Onboarding Exec** opens the seller dashboard → program → assigns categories → **defines products** (attributes from HO master, media, SKU, ML data) → **maps products to locations** with copy counts (one Master per SKU, sizes from the controlled list).
6. **Stickers** are rendered per copy from the category template (KC name auto-filled) and printed; physical samples are placed.
7. **Consumers** scan: visitor → product page; concierge → issue/retrieve; designer → add to BOM.

---

## 8. Permissions Matrix (summary)

| Capability | HO Admin | Branch Admin | Onb. Lead | Consign. | Onb. Exec |
|---|:--:|:--:|:--:|:--:|:--:|
| Categories / Attributes / Brands master | **CRUD** | – | – | – | request |
| Branches | **CRUD** | – | – | – | – |
| Programs | **CRUD** | select | – | – | select |
| Warehouse / Location IDs | view | **CRUD** | view | – | map-to |
| Sellers / Membership | view | – | **CRUD** | – | view (assigned) |
| Seller→Exec assignment | view | – | **CRUD** | – | – |
| Consignment receive / QC | view | – | notify | **CRUD** | notify |
| Product master — create / add new info | view | – | – | – | **free** |
| Product master — modify existing field | **approve** | – | – | – | request |
| Placement (product↔location, copies) | view | – | – | – | **CRUD** |
| Sticker template (category-wise) | **CRUD** | use | use | – | use |
| Sample-size controlled list | seed | – | **add** | select | select |
| Approvals | **decide** | – | – | – | – |

---

## 9. Suggested Phasing **[ASSUMPTION — for discussion]**

- **Phase 1 (MVP):** Modules A–F — master data, warehouse, seller onboarding, consignment QC, product onboarding & placement, and **sticker generation**. The QR is **printed** on every sticker (encoding the instance code), but its **scan-resolution is Phase 2**. Single branch `KC_One`.
- **Phase 2:** **QR scan resolution + BOM** (Module G) and **ML integration** — high-level glimpse in §9.1.
- **Phase 3:** Multi-branch, analytics/metrics, advanced approval routing.

### 9.1 Phase 2 preview (glimpse — full spec deferred)

> High-level only. Phase 1 ships the data model and physical tagging; Phase 2 makes the QR *do things* and wires in the Material Library. Detailed specs come in a later revision; open items are tracked in §10.2 (2–3).

**QR scan resolution & BOM (Module G).** Phase 1 already **prints** the QR — it encodes the instance code `SKU + branch code + sequence`. Phase 2 stands up the **resolver** that turns a scan into a **context-aware action**:
- Generic / visitor scan → **product detail page**.
- **Concierge App** → in-floor **issue/retrieve** availability toggle.
- **Material KC BOM App** → **add the product to the active project cart/BOM**.

**ML (Material Library) integration.** During onboarding, fetch product data from **ML** to pre-fill the Brand Product Master (attributes, media, datasheet) so execs don't re-key. Phase 1 works **without** ML (SKU + manual/seed entry); ML is an **accelerator, not a dependency**.

---

## 10. Decisions & Open Questions

### 10.1 Resolved (2026-06-11)
- **Seller ↔ Brand:** A **Seller** is the contract party and deals in **1..n Brands** (single-brand today; multi-brand dealers later). A Brand owns a **SKU-keyed product catalog reusable across sellers and KCs**.
- **SKU origin:** **Seller-provided** base SKU; KC layers a **branch DNA code** to form a unique per-copy **KC instance code** (so every scan reveals the originating KC and resolves for BOM-add).
- **QR granularity:** **One QR per physical copy**; identical infographic per SKU (only Location ID may differ); each copy tagged **Master/Slave** (slaves may be different sizes).
- **Issue/Retrieve:** **In-floor handling only** — concierge scan toggles availability (out/in); no borrower record or due dates.
- **Product reuse model:** **Hybrid** — a shared **Brand Product Master** per `(Brand, SKU)` holds intrinsic data; a **local overlay** per seller/KC holds contextual data (copies, locations, QR). Governance: **create & augment are open to any exec; modifying an already-populated shared field needs HO edit-approval**; local edits always free. See §5.1–§5.2.
- **Instance code:** the per-copy code **annexes a branch code (KC DNA)** to the seller SKU (+ sequence). **Not human-readable** — used when listing the product and encoded in the QR.
- **Master/Slave & sizes:** exactly **one Master per SKU**; the rest are **Slaves**. Copy **sizes come from a controlled list** the **Onboarding Lead can extend** (self-serve).
- **Warehouse deletion guardrail:** a node **cannot be deleted until all copies under it are relocated**; moving copies updates their Location ID and triggers re-labeling.
- **Sticker template:** **category-wise configurator at HO**, inherited by every branch with the **KC name auto-filled**; elements: brand logo, name, category, selected attributes, Location ID, QR (+ SKU).

### 10.2 Still open (highest-impact first)
1. **Sticker physical spec:** sticker dimensions, material, printer type; batch vs. one-off printing.
2. **ML integration (Phase 2 — glimpse §9.1):** integration mode (API / DB / file import), ML→KC field mapping, match key, sync direction & conflict handling.
3. **QR scan-resolution & BOM (Phase 2 — glimpse §9.1):** deep-link/URL scheme, scanning-app authentication, instance-code → product/copy resolver, offline behavior.
4. **Approval scope (non-product masters):** Which category/attribute/branch changes need HO approval vs. self-serve? (Product-master edit governance resolved — §5.2.)
5. **Auth/SSO:** Authentication method / existing identity provider?
6. **Notifications:** Channel for consignment notifications and approval outcomes (in-app, email, both)?

---

## 11. Changelog
- **v0.6 (2026-06-11):** Renamed the **L2 role "KC Brand Admin" → "KC Branch Admin"** throughout — the role is scoped to *a KC branch* and configures the warehouse/locations (Module B); it never manages brands (a HO master, A3), so the prior name was misleading. No scope or permission change.
- **v0.5 (2026-06-11):** Scoped **QR scan-resolution + BOM** (Module G) and **ML integration** to **Phase 2**; added a high-level glimpse (§9.1) and clarified that Phase 1 still **prints** the QR (encodes instance code) while resolution is deferred. Tagged Modules F4/G/G4 and open items 2–3 accordingly.
- **v0.4 (2026-06-11):** Resolved instance-code (annex branch code, not human-readable), Master/Slave (one Master/SKU) + sizes from a Lead-extensible controlled list, and warehouse deletion guardrail (no delete until copies relocated). Detailed the consignment flow (talk-to-brand → receive → buffer → fabricate → QC → back to exec; Module D). Reworked Module F into a **category-wise HO Sticker Template Configurator** (inherited per branch, KC name auto-fills). Added A7, B5, C6, matrix rows.
- **v0.3 (2026-06-11):** Resolved product-reuse (§10.2-1) → **Hybrid** shared Brand Product Master + local overlay; added §5.1 intrinsic/contextual field split and §5.2 governance (create/augment open, modify-existing → HO approval). Updated Modules E5, H, permissions matrix.
- **v0.2 (2026-06-11):** Seller↔1..n Brands + shared SKU-keyed catalog; seller-provided SKU + KC DNA instance code; one QR per copy with Master/Slave; concierge = in-floor availability toggle. Resolved Q1–Q4.
- **v0.1 (2026-06-11):** Initial structured draft from requirement brief.
