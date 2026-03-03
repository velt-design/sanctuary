# Website Quality Governance

This document defines Phase 5 operational controls for sanctuarypergolas.co.nz.

## Cadence

1. Weekly: Lighthouse guardrails on pull requests and scheduled checks.
2. Monthly: Governance workflow (tests, production dependency audit, Lighthouse desktop + mobile).
3. Quarterly: Third-party tracking register review and cookie/category ownership check.

## Quality gates

1. Lighthouse thresholds:
   - Performance: `>= 0.90` mobile, `>= 0.95` desktop
   - Accessibility: `>= 0.95`
   - Best Practices: `>= 0.95`
   - SEO: `>= 1.00`
2. Security:
   - No unresolved critical/high production vulnerabilities from `npm audit --omit=dev`.
   - CSP report volume reviewed monthly.
3. Privacy:
   - Optional tracking must remain consent-gated.
   - Privacy page must match actual tracking behavior.

## Ownership

1. Engineering:
   - Maintain headers/CSP/CI guardrails.
   - Review monthly governance failures and remediate.
2. Marketing:
   - Own third-party pixel purpose and retention decisions.
   - Confirm tracking inventory remains accurate.

## Change control checklist

Before shipping any new third-party script or pixel:

1. Add/update entry in `docs/tracking-governance.md`.
2. Classify consent category (`analytics` or `marketing`).
3. Verify consent gating in implementation.
4. Re-run Lighthouse and confirm thresholds still pass.
5. Update privacy copy if data behavior changes.
