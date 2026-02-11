# Costing source of truth

All costing logic and config live in `packages/costing`. Do not copy or re-create the engine elsewhere.

## How to import

Use the package entrypoint:

- `import { calculateCostV1, calculateJobCostV1, loadCostingConfigV1 } from '@sp/costing'`

Legacy paths like `src/costing/**` and `apps/portal/src/costing/**` are blocked by lint.

## Overrides in portal

Portal applies DB overrides onto the base config returned by `loadCostingConfigV1()`:

- `apps/portal/lib/costing/overrides.ts` merges materials + install action overrides.
- `apps/portal/lib/costing/costEngine.ts` uses the overridden config for staff calculator routes.

## API entrypoints

- Staff costing API: `apps/portal/app/api/staff/costing/v1/route.ts`
- Staff costing job API: `apps/portal/app/api/staff/costing/v1/job/route.ts`
- Marketing enquiry estimate: `apps/marketing/app/api/enquiry/route.ts`
