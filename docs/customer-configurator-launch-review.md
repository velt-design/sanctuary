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
| Complete configured-form controller recovery | Mocked network integration checks required-field refusal, edited pre-send snapshot, unchanged-request retry identity, success and contact-storage cleanup | 3 controller tests passed; 28 contact tests passed; no external submission |
| Lost response followed by edited retry | Existing receipt response now explicitly identifies the earlier enquiry and excludes subsequent changes; contact storage retained and confirmation focused | Passed with mocked receipt; no duplicate submission identity |
| Commercial header route | Commercial page header opens contact with Commercial/Professional and Organisation/venue selected | Passed locally |
| Product-detail entry | Pitched product page bar opens the working configurator over the same product URL; closing restores the product page | Passed locally |
| Mobile expanded viewer | 390 x 844: Day/Night absent in compact view, present expanded; screenshot inspected; Escape returns to controls and focuses Expand | Browser simulation passed |
| Mobile menu and professional route | Opening menu removes sticky bar; Professionals opens its page; menu contact link retains professional source and selects Architect/designer/builder | Passed locally |
| Shared design and refresh | Copied 5.6 x 3 m pitched design opens in a new tab with $10,630 draft estimate; reload retains both | Passed locally for this fixture |
| Release compilation | Webpack production build completed all 77 static pages and TypeScript after fixing an invalid all-global CSS-module selector in the sticky-bar stylesheet | Passed locally with webpack; default Turbopack process crashed on Windows before diagnostics |
| Hosted candidate preparation | Healthy staging identity and existing approved hash rechecked; v2.8 control snapshot hashes to `4d12a6bde67c28aeacbb8a0d9845529e3ebb7405555d0fab9b8e412de8d33661`; resolving that snapshot is deeply equal to the current local candidate configuration | Prepared and validated; not published or deployed |

## Open requirements

- Complete remaining consent interaction, complex shared-design preservation and
  browser Back while the configurator itself is open. Product, commercial,
  professional, mobile menu and expanded-view checks above now have browser evidence.
- Verify form recovery against the isolated hosted service. Local controller
  success, failure and retry tests intercept all network calls; they do not prove
  receipt by the hosted intake or staff portal.
- Prepare one exact candidate for hosted verification. The current review-price
  endpoint and hook are development-only. A normal hosted build will not reproduce
  the local v2.8 estimate automatically. Preserve the signed published-price boundary.
  Read-only Vercel inspection at 07:01 UTC confirms this candidate branch has no
  branch-specific staging variables and no deployment in either project's most
  recent 20 results. Existing launch-candidate staging bindings and existing
  automation credentials are available for reuse. Do not push/deploy this branch
  before isolating its bindings; do not inherit production credentials by default.
- Reconcile current hosted pricing, staff receipt/revision and save-to-quote against
  this candidate. Earlier staging evidence is valuable but is not proof of this UI
  and pricing revision.
- Real-phone touch, keyboard and assistive-technology verification remains open.
- Check release build, hosted CI, production migration/configuration differences,
  worker readiness and rollback before presenting a production activation decision.
  Local webpack compilation is verified; the normal hosted build still needs its
  own result. Local logs are `sanctuary-launch-review-build.txt` and
  `sanctuary-launch-review-webpack.txt` in the task's temporary directory.

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
