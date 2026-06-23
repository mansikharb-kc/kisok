# RMS — Project Structure (scaffold, phase-wise)

> Skeleton only. Each file is a stub marked with its **phase** and purpose. No business logic yet.
> Read with `RMS-PLAN.md` (features/flows) and `ARCHITECTURE.md` (system).

## Phase map

| Phase | Theme | Folders/files |
|---|---|---|
| **P1.0 Shell** | RMS theme + kiosk layout | `lib/rms/theme.ts`, `app/rms/layout.tsx` |
| **P1.1 Security** | Screen Manager + device activation | `app/(app)/rms-screens/*`, `app/api/rms/device/route.ts`, `components/rms/DeviceGate.tsx`, `app/rms/screen/[token]/layout.tsx` |
| **P1.2 Home** | Local + 3 global modes | `app/rms/screen/[token]/page.tsx`, `components/rms/{DiscoveryHome,RmsTopBar}.tsx` |
| **P1.3 BBC** | Browse by Category | `app/rms/screen/[token]/category/page.tsx`, `components/rms/CategoryGrid.tsx` |
| **P1.4 Product detail** | shared detail page | `app/rms/screen/[token]/product/[productId]/page.tsx`, `components/rms/ProductDetail.tsx` |
| **P1.5 BBB / BBP** | Brand / Product browse | `app/rms/screen/[token]/brand/page.tsx`, `components/rms/BrandGrid.tsx` |
| **P1.6 BOM** | cart + quote | `app/rms/screen/[token]/bom/page.tsx`, `components/rms/BomCart.tsx`, `app/api/rms/bom/route.ts` |
| **P1.7 Analytics** | interaction events + dwell-time | `app/api/rms/events/route.ts`, `lib/rms/analytics.ts` |
| **P1.8 Suggestions** | multi-brand recommendations | `app/api/rms/recommendations/route.ts` |
| **P1.9 i18n + a11y** | language + accessibility | `lib/rms/i18n.ts`, `components/rms/LanguageSwitcher.tsx` |
| **P1.10 Customer/Quote** | customer ID + QR handoff | `components/rms/CustomerCapture.tsx` (stub) |
| **P2 Enterprise** | SSO, API platform, AR, etc. | not scaffolded — see ARCHITECTURE §12 |

## Tree
```
src/
├── app/
│   ├── rms/                                  ← kiosk (no sidebar/login, own theme)
│   │   ├── layout.tsx                        P1.0
│   │   └── screen/[token]/
│   │       ├── layout.tsx                    P1.1  device guard + top bar + block ctx
│   │       ├── page.tsx                      P1.2  Home
│   │       ├── category/page.tsx             P1.3  BBC
│   │       ├── brand/page.tsx                P1.5  BBB/BBP
│   │       ├── product/[productId]/page.tsx  P1.4  detail
│   │       └── bom/page.tsx                  P1.6  cart
│   ├── api/rms/
│   │   ├── device/route.ts                   P1.1
│   │   ├── events/route.ts                   P1.7
│   │   ├── bom/route.ts                       P1.6
│   │   └── recommendations/route.ts          P1.8
│   └── (app)/rms-screens/                     ← admin (Branch Admin + Screen Manager)
│       ├── page.tsx                          P1.1  bind screens to blocks
│       └── devices/page.tsx                  P1.1  device approval queue
├── components/rms/
│   ├── RmsTopBar.tsx                          P1.2
│   ├── DiscoveryHome.tsx                      P1.2
│   ├── CategoryGrid.tsx                       P1.3
│   ├── BrandGrid.tsx                          P1.5
│   ├── ProductDetail.tsx                      P1.4
│   ├── BomCart.tsx                            P1.6
│   ├── DeviceGate.tsx                         P1.1
│   ├── CustomerCapture.tsx                    P1.10
│   └── LanguageSwitcher.tsx                   P1.9
└── lib/rms/
    ├── theme.ts                               P1.0
    ├── types.ts                               P1.0
    ├── queries.ts                             P1.2  subtree stock query
    ├── analytics.ts                           P1.7
    └── i18n.ts                                P1.9
```

## Not scaffolded yet (needs migration/decision, not "structure")
- DB tables: `screen_devices`, `bom_lists`, `bom_items`, `rms_events`, rollups, `recommendations`, `branch_settings`, `customers`, flags (`is_sponsored`, `is_featured`) → `prisma/schema.prisma` + `prisma/migrations-manual/`.
- `SCREEN_MANAGER` role in `src/lib/rbac.ts`.
These are implementation steps, added when each phase is built.
