# Customer journey launch review

Status: **launch-review milestone verified; production activation blocked by the
release gates below**. Updated 16 September 2026.
Owner: marketing/configurator release lane. Current branch:
`codex/configurator-pricing-candidate-20260915`; local preview port 3074.
This is a verification record, not permission to publish pricing, activate
production, send emails or submit live customer enquiries.

## Current evidence

Hosted intake exposed the database's older mandatory-phone rule despite the
configured form accepting an empty phone. Forward migration
`20260915080001_marketing_enquiry_optional_phone.sql` now allows the configured
residential email/suburb/design path and skips blank-phone contact matching.
Applied and recorded only in staging. Transactional regression checks passed for
separate email identities, same-email matching, replay, null phone storage and
legacy/no-contact rejection. Production still requires this migration.

The same failed submission was reconciled before retry: no receipt existed and
all 14 earlier estimate snapshots were unchanged. Hosted retry saved the exact
$11,674 design and approved version 2; duplicate retry reused its receipt.
Authenticated staff retrieved that frozen design/price while anonymous access
was denied. Staff revised width to 6.2 m, prepared $12,031, saved a separate
revision, replayed safely, and created/reloaded an unsent DRAFT quote at $12,031.
The original estimate remained unchanged. Its synthetic email job was parked
with zero provider effects. Evidence: `sanctuary-v28-intake-check.json`,
`sanctuary-v28-staff-receipt.json`, `sanctuary-v28-staff-revision.json` in the task
temporary directory. No customer/provider delivery was attempted.

The focused database migration guard passes 26 tests. Docker's Linux engine is
unavailable locally; the SQL regression passed in a staging rollback transaction.
Fresh hosted database contracts exposed duplicate contact prerequisites between
the enquiry and finance test suites. The finance bootstrap now preserves an
existing compatible contact table/column. All four Background Jobs jobs pass at
`4aed856`, including PostgreSQL 17 and 18, worker runtime and provider contracts:
https://github.com/velt-design/sanctuary/actions/runs/34943919707.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Back with designer open | Products to Gable product detail, open overlay, browser Back returns to Products with no orphaned dialog | Passed locally |
| Detailed shared design | 6 x 3 freestanding gable, combination roof, cedar ceiling, Front 1 acrylic and four perimeter LED strips: copied link restored all selections and $31,543; refresh retained design and price | Passed locally |
| Cookie choices and bar | Privacy preferences hide design bar; Essential only dismisses panel and restores trigger focus/bar; reopened choices show both optional categories off | Passed locally |
| Hosted form recovery and edit return | Missing suburb/email focus error summary; entered name/suburb retained through edit; width 6.2 yields $12,031; Enquire closes same-page dialog and restores edit-link focus; invalid email rejected without submission | Passed on connected hosted marketing build |
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
| Hosted candidate preparation | Healthy staging identity rechecked; v2.8 snapshot `4d12a6bde67c28aeacbb8a0d9845529e3ebb7405555d0fab9b8e412de8d33661` resolves exactly to the local candidate. Published only in staging as version 2, `89a1d161-c336-44e6-ad2b-2b8eacd3bd4c`; temporary admin access removed | Staging only; production unchanged |
| Candidate repository gates | Full workspace typecheck and lint, including documentation, package boundaries and source guards, passed before branch upload at `a403953` | Passed |
| Isolated hosted bindings | Both applications have candidate-branch-only staging credentials, v2.8 version pin, disabled email provider and disabled enquiry email worker. Stable customer/staff preview origins connected | Both connected builds READY at `a403953`; staff receipt, revision and draft quote verified |
| Hosted/local price parity | Signed hosted v2.8 API matched local estimates: acrylic 6 x 3 $11,674; 5.6 x 3 $10,630; solid/ThermoPine 5 x 4 $20,606; 5 x 4.1 $21,308; acrylic gable 6.7 x 3.9 $18,561. 6.7 x 4.5 returns tailored quote | Five price fixtures plus area limit passed; no enquiry submitted |

## Completion audit and remaining launch gates

- Hosted validation recovery and edit return pass. Network-failure recovery is
  covered by controller tests; hosted intake/retry are separately verified above.
- Owner real-phone journey check passed on 16 September: size changes, expanded
  3D, enquiry entry, edit and return. This does not claim an assistive-technology
  audit or actual email delivery.
- Portal Quality/performance run passed at the unchanged application
  source `5bde079`: https://github.com/velt-design/sanctuary/actions/runs/34943618230.
  All three jobs passed, including the configurator/enquiry journey, production
  build, security checks, browser fixtures and signed-in staff smoke. The later
  `4aed856` change is
  only the disposable finance bootstrap covered by the separate passing run.
- Check release build, hosted CI, production migration/configuration differences,
  worker readiness and rollback before presenting a production activation decision.
  Local webpack and both normal hosted builds are verified at `a403953`.
  Local logs are `sanctuary-launch-review-build.txt` and
  `sanctuary-launch-review-webpack.txt` in the task's temporary directory.

## Production activation prerequisites

Read-only production inspection on 15 September found the seven queue foundation
migrations already installed and one worker with a recent `ready` heartbeat.
This supersedes the earlier manifest's assumption that the queue is absent; it
does not prove the website-enquiry handler is configured or safe to activate.
The following five migrations are absent and need the controlled release process:
`20260914062001`, `20260914062002`, `20260914062003`, `20260914173001`,
`20260915080001`. No production schema or settings were changed by this audit.

Before launch, reconcile PR #132 with this isolated release branch, finish its
release gates, approve the exact production pricing version and matching app
bindings, and verify enquiry-specific worker health, receipt monitoring and
shutdown behaviour. Rollback must disable the new enquiry entry/producer and
pause claims without deleting frozen enquiries, estimates, drafts or effect
checkpoints. Do not switch failed durable enquiries into automatic legacy sends.
The production deployment procedure remains a launch gate. The owner completed
the requested real-phone journey on the `sanctuary-cbcea5b04` Vercel preview and
reported "I've checked it and it works well" on 16 September. No submission was
requested; this clears the owner device check, not email delivery verification.

The release branch integration with production main `27528e9` passed 1,444 tests
across 193 files covering marketing, costing, staff pricing classification,
worker runtime and job contracts. Final hosted release checks remain separate.

The prior eleven-file migration handoff has no semantic changes in this branch.
Two checkout files use CRLF while the old manifest hashes LF, so raw hashes differ
without SQL changes. Canonical Git content and normalized hashes match. Use the
current exact deployment bytes for release verification; the private temporary
`sanctuary-current-release-migration-hashes.json` records the comparison and the
five currently absent production files.

This milestone covers the local/hosted customer journeys, price parity, frozen
staff receipt, revision, draft quote, regression and build evidence above. It
does not approve PR #132 for merge, publish the v2.8 production pricebook, enable
the website enquiry worker or prove actual customer-email delivery. Those remain
explicit release decisions and checks. Review locally at http://localhost:3074/;
the connected hosted marketing application is
https://sanctuary-cbcea5b04-jordans-projects-43df95bd.vercel.app/configurator-preview?open=1.

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

No production changes, purchases, emails or live customer enquiries were made in
this audit. Synthetic staging configuration/setup writes are recorded separately
from customer and staff runtime verification.

## Pricing release continuation, 16 September 2026

Owner authorised the exact staging pricebook for new staff and customer
configurator calculations. Pricing-only PR #136 merged at
`27528e9b1c3fe10d3b01a112ea765ef4f09a90fb`. Both production applications are READY
at that commit: marketing `dpl_6Yz9Ti9bdHe1QDfzEw8c4RF2o7bE`, portal
`dpl_6oBJdbxLh6VYr9gwJcgwzoJAeFoo`. All required checks passed at corrected head
`600b962c9e7d2b6784663d754ab8b061ff6d7e4d` (run 35024401773).

Review caught a staff UI classification bug: configuration-free eligibility
rejected infills and rewrote Simple as Bespoke before costing. Corrected in the
pricing release, with a React-hook integration regression; historical server
eligibility still uses its explicit published configuration. Carry this correction
when reconciling this configurator branch with main.

Publication is NOT complete. At 21:31 UTC on 15 September, Supabase management
reported scheduled maintenance, estimated completion 21:45 UTC. The guarded
preparation stopped at the project-health check before authentication/draft writes;
no preparation/publication evidence file exists. Last verified production remains
Version 12 (`481e870d-aafa-4c4b-8735-1e5e5565032d`, hash `157b63465bc0...`).

Resume after management health is available: rerun the guarded production
preparation, inspect the exact comparison, publish approved hash
`4d12a6bde67c28aeacbb8a0d9845529e3ebb7405555d0fab9b8e412de8d33661`, and run live
staff/public proof. Scripts/evidence use the `sanctuary-v28-production-*` prefix in
the task temporary directory; expected deployment commit is the merge above.
`sanctuary-v28-production-proof.mjs` verifies ceiling options, unequal wings,
4m rafter boundary and infill classification without saves/emails. The public
before fixture is Version 12 at $11,500. No renewed owner approval is needed for
this same approved pricebook. Customer website/enquiry activation remains separate.

## Pricing publication completed, 16 September 2026

The maintenance hold above is resolved. At 21:45:45 UTC on 15 September
(07:45 Sydney on 16 September), the authenticated admin workflow published
Version 13, `9e1a4281-95c0-45f2-948d-67a51df71e5d`, with exact approved hash
`4d12a6bde67c28aeacbb8a0d9845529e3ebb7405555d0fab9b8e412de8d33661`.
Both live apps were rechecked READY at `27528e9b1c3fe10d3b01a112ea765ef4f09a90fb`
before draft preparation and again before publication. The server comparison
showed only the effective manifest change from v2.7 to v2.8; rates were unchanged.

Live authenticated staff verification passed all five legacy/new ceiling choices,
two independent unequal-wing stock checks, four rafter boundary cases and the
acrylic-side no-whole-job-increase versus explicit Bespoke check. No estimates or
quotes were saved and no emails were sent. The public Simple cover endpoint
returned Version 13 and its unchanged $11,500 baseline. A separate read-only SQL
check confirmed the publication pointer and `config_json.baseManifestVersion`
value v2.8. Evidence: temporary `sanctuary-v28-production-preparation.json`,
`sanctuary-v28-production-publication.json`, `sanctuary-v28-production-proof.json`
and `sanctuary-v28-public-after.json`.

The standalone `base_manifest_version` database metadata column carries the draft
clone's older value v2.7; the hashed config JSON actually used by the resolver is
v2.8. Do not infer active calculation rules from that legacy column alone. The
live framing/classification checks demonstrate the v2.8 rules are active.

This completes the approved shared pricebook publication. The expanded customer
configurator/enquiry application launch remains separate; bind its approved-version
setting to this production UUID during that release. Existing frozen estimates
and quotes were not rewritten. The UI release must still retain PR #136's staff
classification correction when reconciled with main.
