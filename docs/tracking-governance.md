# Tracking Governance

This register documents third-party tracking used on the marketing site and the consent category each integration requires.

## Consent categories

- `essential`: required for core site behavior.
- `analytics`: measurement and site performance analysis.
- `marketing`: advertising attribution and remarketing.

## Integration register

| Integration | Category | Load path | Purpose | Owner | Review cadence |
| --- | --- | --- | --- | --- | --- |
| Google Analytics (GA4) | analytics | `apps/marketing/components/Analytics.tsx`, `apps/marketing/app/runtime-ga.js/route.ts` | Page and event analytics, Web Vitals reporting | Marketing + Engineering | Monthly |
| Meta Pixel (browser) | marketing | `apps/marketing/components/MetaPixel.tsx`, `apps/marketing/app/runtime-meta.js/route.ts` | Browser-side lead attribution | Marketing | Monthly |
| Meta Conversions API (server) | marketing | `apps/marketing/app/api/contact/route.ts` | Server-side lead conversion reporting | Marketing + Engineering | Monthly |
| ArchiPro Pixel | marketing | `apps/marketing/components/ArchiproPixel.tsx`, `apps/marketing/app/runtime-archipro.js/route.ts` | Campaign performance tracking | Marketing | Quarterly |

## Operational rules

1. Optional categories (`analytics`, `marketing`) must not load before explicit consent.
2. New third-party scripts require:
   - documented owner and purpose in this file;
   - mapped consent category;
   - privacy policy update if data behavior changes.
3. Any script no longer in use must be removed from both code and this register.
