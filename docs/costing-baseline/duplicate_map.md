# Costing duplicate map (baseline)

Generated: 2026-02-11

## Engine copies found

- Canonical:
  - packages/costing/src/engine

- Legacy / duplicates:
  - src/costing/engine (legacy copy + tests) — removed in this branch
  - apps/portal/src/costing/engine (thin re-export shims to `@sp/costing`) — removed in this branch

## Config copies found

- Canonical:
  - packages/costing/src/config

- Legacy / duplicates:
  - src/costing/config — removed in this branch

## References found (imports)

- Direct imports now use `@sp/costing` in:
  - apps/marketing/app/api/enquiry/route.ts
  - apps/portal/app/api/staff/costing/v1/route.ts
  - apps/portal/app/api/staff/costing/v1/job/route.ts
  - apps/portal/app/api/staff/costing/v1/meta/route.ts
  - apps/portal/app/pricebook/page.tsx
  - apps/portal/lib/costing/overrides.ts
  - apps/portal/lib/costing/costEngine.ts
  - apps/portal/lib/quotes/mapping.ts
  - apps/portal/lib/types/*, apps/portal/lib/outputs/*

- Legacy shim files that re-export from `@sp/costing`:
  - src/costing/engine/{calculate,config,types}.ts — removed in this branch
  - apps/portal/src/costing/engine/{calculate,config,types}.ts — removed in this branch

## File inventory (engine/config)

See `git ls-files | rg "(^|/)costing/(engine|config)/"` for the complete list.

## Post-move note

- Canonical engine/config are `packages/costing/src/engine` and `packages/costing/src/config`.
- Application code should import only from `@sp/costing`.
