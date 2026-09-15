# Customer journey launch review

Status: **in progress, not approved for production**. Updated 15 September 2026.
Owner: marketing/configurator release lane. Current branch:
`codex/configurator-pricing-candidate-20260915`; local preview port 3074.
This is a verification record, not permission to publish pricing, activate
production, send emails or submit live customer enquiries.

## Current evidence

| Requirement | Evidence | Status |
| --- | --- | --- |
| Homepage bar waits only for short opening scroll | Four bar tests; existing-tab browser verification after dismissal correction | Passed locally |
| Other public browsing pages show bar immediately | Products browser verification and bar test | Passed locally |
| Open/close over the same page | Products URL and scroll preserved; shared dialog test | Passed locally |
| Keep normal contact and bespoke entry | Header contact links checked; bespoke route renders selected bespoke fields | Passed locally |
| Historical contact designer uses dedicated enquiry | Browser Review link to `/design-enquiry`; dead Design/Project details navigation absent | Passed locally |
| Review and enquiry price match | Gable 6.7 x 3.9: $18,561 on both; projection edit to 3.8: $18,054 on enquiry and breakdown | Passed locally |
| Edit from enquiry and return | Same-page return closes overlay and preserves typed name; regression test | Passed on fresh load |
| Products to enquiry, browser Back/Forward | 5.2 x 3 pitched: $10,484; Back returned to Products, Forward restored enquiry and typed name | Passed locally |
| Source attribution | Products enquiry URL retained `source_path=/products`; edit preserves original source test | Passed locally |
| Missing-field recovery | 390 px enquiry: empty suburb/email produced inline errors and focused summary before network submission | Passed locally |
| Mobile enquiry layout | 390 x 844 screenshot inspected; price, edit link, fields and disclosure visible | Browser simulation only |
| Historical versus new candidate price tests | Historical 45-proposal fixture now explicitly uses v2.7; v2.8 owner rules and frozen pricing tests passed, 25 tests combined | Passed |
| Current full marketing suite | 841 tests in 134 files passed after historical-fixture correction; architecture changed report clean | Passed locally |

## Open requirements

- Complete public entry matrix, including commercial/professional and product-detail
  pages, consent/menu interactions, refreshed/shared designs and mobile expanded view.
- Exercise complete form success, failure and retry with intercepted/local test
  services only; no email or live customer submission.
- Prepare one exact candidate for hosted verification. The current review-price
  endpoint and hook are development-only. A normal hosted build will not reproduce
  the local v2.8 estimate automatically. Preserve the signed published-price boundary.
- Reconcile current hosted pricing, staff receipt/revision and save-to-quote against
  this candidate. Earlier staging evidence is valuable but is not proof of this UI
  and pricing revision.
- Real-phone touch, keyboard and assistive-technology verification remains open.
- Check release build, hosted CI, production migration/configuration differences,
  worker readiness and rollback before presenting a production activation decision.

## Earlier release evidence and limits

PR #132 is still draft at `cd9c2b3`; its reported hosted checks pass at that head.
It does not contain this release branch's subsequent journey changes. The private
`START-HERE-launch-handoff-20260915.md`, `launch-verification-20260915.md` and
`staff-pricing-live-20260915.md` were inspected in the original configurator UI
checkout's `artifacts/pricing-review-2026-09-11` directory. Do not copy their private
customer artifacts into the public repository.

Those records show historical hosted staff V3 and an unsent draft quote preserved
their source prices. They also supersede older notes about hosting: the owner chose
Render, and production staff pricing Version 12 was published separately. Neither
decision activates this configurator or publishes the later v2.8 candidate.

No production changes, purchases, emails or live enquiries were made in this audit.
