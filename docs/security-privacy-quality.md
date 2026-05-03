# Security, Privacy, And Quality

This doc combines operational controls for tracking, consent, security, and quality gates.

## Consent Categories

- `essential`: required for core site behavior.
- `analytics`: measurement and site performance analysis.
- `marketing`: advertising attribution and remarketing.

Optional categories must not load before explicit consent.

## Tracking Register

| Integration | Category | Load Path | Purpose | Owner |
| --- | --- | --- | --- | --- |
| Google Analytics GA4 | analytics | `apps/marketing/components/Analytics.tsx`, `apps/marketing/app/runtime-ga.js/route.ts` | Page and Web Vitals analytics | Marketing and Engineering |
| Meta Pixel browser | marketing | `apps/marketing/components/MetaPixel.tsx`, `apps/marketing/app/runtime-meta.js/route.ts` | Browser-side lead attribution | Marketing |
| Meta Conversions API | marketing | `apps/marketing/app/api/contact/route.ts` | Server-side lead conversion reporting | Marketing and Engineering |
| ArchiPro Pixel | marketing | `apps/marketing/components/ArchiproPixel.tsx`, `apps/marketing/app/runtime-archipro.js/route.ts` | Campaign performance tracking | Marketing |

When adding or removing tracking, update this table and the privacy behavior.

## Security Rules

- Never commit secrets or env files.
- Keep service-role Supabase access server-only.
- Use portal auth helpers for staff/admin API routes.
- Keep public quote and invoice flows token-bound.
- Keep automation, email outbox, and audit side effects aligned with `docs/automation-email-audit.md`.
- Run production dependency audits for governance checks.
- Preserve CSP reporting and review unexpected report volume.

## Quality Gates

Marketing Lighthouse thresholds:

- Performance: at least `0.90` mobile and `0.95` desktop.
- Accessibility: at least `0.95`.
- Best Practices: at least `0.95`.
- SEO: `1.00`.

Security:

- No unresolved critical/high production vulnerabilities from `npm audit --omit=dev`.
- Portal Quality runs `npm run audit:security` as a blocking pull-request gate; Governance Monthly also runs the production dependency audit as part of the broader marketing/governance sweep.

Privacy:

- Tracking behavior must match consent and privacy copy.
- New third-party scripts need owner, purpose, consent category, and privacy review.

## Guard Commands

```bash
npm run audit:security
npm run audit:lighthouse
npm run audit:governance
npm run text:mojibake
npm run brand:forbid
npm run cache:forbid
```

## Ownership

Engineering owns headers, CSP, CI guardrails, secret boundaries, and technical remediation.

Marketing owns third-party pixel purpose, retention decisions, campaign attribution needs, and privacy copy review.
