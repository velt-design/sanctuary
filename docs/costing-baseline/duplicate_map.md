# Costing duplicate map (baseline)

Generated: 2026-02-02

## Engine copies found

- Canonical (runtime for staff calculator):
  - apps/portal/src/costing/engine
  - Reason: apps/portal API routes import from `@/src/costing/engine/calculate` and `@/src` maps to `apps/portal/src` in `apps/portal/tsconfig.json`.

- Duplicate copy:
  - src/costing/engine

## Config copies found

- Canonical (runtime for staff calculator):
  - apps/portal/src/costing/config

- Duplicate copy:
  - src/costing/config

## References found (imports)

- apps/portal/app/api/staff/costing/v1/route.ts -> `@/src/costing/engine/calculate`
- apps/portal/app/api/staff/costing/v1/job/route.ts -> `@/src/costing/engine/calculate`
- apps/portal/lib/costing/costEngine.ts -> `@/src/costing/engine/types`
- apps/portal/lib/costing/overrides.ts -> `@/src/costing/engine/config`
- apps/portal/app/pricebook/page.tsx -> `@/src/costing/engine/config`
- apps/marketing/app/api/enquiry/route.ts -> `../../../../../src/costing/engine/calculate`

## File inventory (engine/config)

See `git ls-files | rg "(^|/)costing/(engine|config)/"` for the complete list.

## Post-move (Phase 2) note

- Canonical engine/config moved to `packages/costing/src/engine` and `packages/costing/src/config`.
- apps/portal now imports from `@sp/costing`.
