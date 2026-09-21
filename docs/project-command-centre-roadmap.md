# Project Operational Command Centre Roadmap
## Current Portal journey trial - 21 September 2026

Owner task: Review Velt OS direction chats (01a0a7f8-d1c5-73c3-b810-20a01e469fed).
Scope authorized by Jordan's "go ahead": inspect the live project journey, fix
highest-impact friction in a preview, independent delivery review, then owner task
attempt. Jordan subsequently reported "great works fine" and approved merge and
production release once checks pass (21 September, same owner task, "yes").
Release authority covers the approved PR169 fix after checks and production verification; no
sends, reminders, AI summaries, migrations or new email-speed changes.
Release paused: hosted tests passed a0a6c774, but GitHub's required conversation
gate caught a commercial-editor remount regression when customer data hydrates.
The merge was refused; no override or production change occurred. Necessary
correction stays within the approved feature: reset disclosure state without
remounting unrelated editors; remount only the correspondence read on identity
change. Tests cover retained quote/invoice/estimate editor nodes and unsaved
input, plus fresh authorization and no old email display on identity change.
Independent second focused recheck closed this finding (45 affected tests);
the builder's full 237 project-page tests, Portal type checking, lint and changed
architecture/documentation guards pass. Next: corrected protected preview and
fresh hosted checks before merge. Earlier review-ready statements below apply only to the
normal email journey, not this subsequently discovered integration edge case.
Current live baseline verified: origin/main7b189bf6, deployment
dpl_3aXiCAPBeA3Kjt5X6biew9tesLo5. PR153 was released as6dee988 on18September;
older pending-release/performance status below is historical, not current.
Working version: C:/Dev/sanctuary-project-journey-20260921,
branch codex/project-journey-20260921 from7b189bf6. Previous dirty worktree retained.

Task: from Projects, find the latest customer reply and current agreed quote,
open the reply, inspect the quote and return. Reference: owner-approved Portal
email reader and commercial card, preserving Portal components and source truth.
Checks: important facts remain distinguishable; disclosure controls stay in place
and reading state returns after authorized reads; real desktop review link works.
Use a synthetic equivalent for shareable tests; private live customer evidence
stays out of repository files. Relevant dimensions: outcome, usability, clarity,
visual/accessibility, system fit, maintainability, reliability, privacy, performance
and handover. No product or commercial assumptions need changing.

Baseline: builder found the linked reply and accepted current quote from the
normal Projects list. Quote navigation works. Returning to Overview took4997ms
in one browser-tool timed sample; the previously open reply was closed. This is
not a percentile, new first-time benchmark or ordinary-staff proof. Opening a
message removes its teaser above the disclosure, moving the control unexpectedly.
Implemented at a0a6c774 in draft PR169. Corrected protected deployment
dpl_9ue3Cbt2E8BbtuvCpUhyykt9JPYY uses the existing staff review alias; the
production alias remains on dpl_3aXiCAPBeA3Kjt5X6biew9tesLo5. Builder verified
the normal Projects-to-reply-to-current-quote-and-return journey with authorized
real reads. Reply and quoted-history disclosures restore on return. Repeated
keyboard open/collapse keeps the settled control at the same document position.
No customer record was edited and no email sent. The new mounted read measured
4112ms on entry and 2917ms on return (individual instrumented observations, not
percentiles or proof of improvement against a comparable controlled baseline).
The earlier 1-2 second performance target remains unmet.
All 233 project-page tests, Portal type checking, changed-file ESLint,
architecture:changed, docs:impact, docs:guard, text:mojibake and diff whitespace
checks passed. Hosted Portal Quality/performance checks remain running.
Independent reviewer journey_trial_review completed the normal entry and return
journey, keyboard/focus and desktop-emulated 390px layout checks. One finding:
an explicit mailbox-unavailable limitation in a ready response did not clear
remembered disclosures. Accepted and corrected with a recovery regression;
35 affected tests and changed-file lint pass. The independent focused recheck
closed the finding. Builder verified corrected hosted access, full reload reset,
and quote/Overview return restoring the opened reply. Corrected return measured
2659ms from mail mount; one full document reload took 10306ms to committed mail
(1511ms from mail mount). This separates page-start time from the email read and
does not establish a speed gain. No further performance work is claimed here.
Independent bounded assessments: outcome/usability, clarity, visual/keyboard,
system fit/maintainability, privacy, reliability and desktop handover each 8/10,
supported by the observed journey, boundary tests and working protected access.
Jordan accepted the review experience with "great works fine". Physical-phone
behavior and ordinary-staff acceptance remain unverified; broader loading
performance is still below the agreed target. Hosted CI remains running and
production unchanged. Next authorized action: complete the existing release
checks, merge exact approved head, deploy and verify the read-only live journey.
This is one successful owner review, not proof of general procedure effectiveness. This trial
caught one requirement gap before owner review; that alone does not prove less
rework or better human task completion.
Publication review: the outgoing source/tests/docs were inspected for the public
repository; tests use synthetic messages. No customer correspondence, screenshots,
credentials, signed links or local evidence artifacts are included. Production
alias changes and release were outside the preview stage's authority; the later
explicit approval above supersedes that boundary for this revision only.

## Historical performance implementation and evidence
## Active customer-email performance goal — 17 September 2026

Owner authorized a goal loop targeting saved-email visibility within 1–2 seconds, with first-time versus saved measurements and honest reporting of unmet targets. Preserve all access/customer/connection revocation, matching, encryption/retention, source links and timestamps. No redesign, sends, bulk backfill, AI summaries, new service or higher limits. New performance revisions require separate production release authority. The prior ordinary-staff live check remains explicitly outstanding, moved post-release by Jordan.

### Current evidence and requirements

| Requirement | Status / evidence |
| --- | --- |
| Baseline and first-time/saved measurements | Production baseline accepted reload 9843ms; quote navigation 7087ms, both saved. Current protected565cea7 accepted first visit10713ms/repeat6210ms, quote saved6660ms, enquiry first13441ms/repeat4965ms. Preview first-time GET returned no saved result, followed by POST. Production new-enquiry16986ms showed a newly checked timestamp, but prior snapshot absence is unverified; do not call it definitive cold baseline. Browser-tool wall clock includes navigation/automation overhead; phase logs provide separate server evidence. |
| Minimal project/customer checks | Verified code/tests on565cea7: auth-bound project/contact identity only, final staff role and customer recheck preserved. No owner/work-model reads on correspondence route. |
| Safely reuse verified send identities | Verified bounded512-entry AES-GCM server-instance cache,15minute expiry; canonical SENT rows remain fresh, key binds project/provider/recipients/provider credential. Expiry/key/recipient/project changes and failure cases tested. No body/auth cache or disk persistence. Hosted accepted matching1434ms first/69ms repeat; instance warmth varies. |
| Saved evidence while refreshing and early mounting | Verified component tests and independent real desktop return/reload/disclosure journey. Emails start from project summary in separate Suspense, without waiting for full notes/events. Access-ending state unmounts emails. Existing15min reuse/24hr retention and expiry behavior retained. |
| Performance target | NOT MET. After Sydney release, warm quote mail retrieval measured663ms. Direct DOM timings on protected ac05904 accepted-project reloads:9045ms then7081ms from navigation;3579ms then3347ms from email mount. Matching still1199–1575ms. DOM timing excludes browser-tool completion overhead. No passing overall outcome/handover rating. |
| Independent quality/security check | Reviewer email_speed_review inspected exact Portal565cea7 and ran63 focused tests; no mandatory code/cache/access defect found. Real quote preview reload, Commercial→Overview, source link/timestamps and expansion independently verified. Actual staff-role/revocation proof remains unverified; owner-deferred staff check is not silently closed. |
| Release | Owner-approved Velt PR380 dd19d3e merged as32ff63c and deployed to dpl_6WaoZ6gX9hWaW7NeHaPEg8K6N7iW; live health and actual syd1 placement verified. Portal draft PR153 remains unmerged and not authorized for production. Goal remains active. |

### Active revisions and next work

Portal worktree sanctuary-project-clarity, branch codex/project-email-speed-20260917, HEAD fabc0c828a08de804fd82a3d40daaf1ed9d2e14b (base e8894d9). Protected Ready deployment dpl_CTkhwBmidDvvS5CymwLMZZ2YhKiC is assigned to https://sanctuary-portal-git-codex-pro-2efc62-jordans-projects-43df95bd.vercel.app . Public Portal remains dpl_93wirCt9Vmp3zesX7AghYh29bu78. No Portal performance release approval.

Current batch starts saved GET alongside summary loading, handing off only a still-pending request. Independent reviewer caught completed replies outliving customer/access changes during shell loading; correction1 discards all settled unclaimed replies, and reviewer independently verified26 lifecycle tests. Builder ran95 focused tests (2 hosted-only tests skipped), full pre-push checks, Portal types and architecture checks. Hosted CI remains pending. Unrelated tsconfig newline-only dirty file is untouched.

Actual corrected preview: accepted project full reload8469ms, immediate repeat2885ms (email component2550/939ms). Enquiry full navigation4877ms, repeat2579ms (email component1453/369ms). Normal Projects-list Open link3064ms wall time including automation; component1338ms. Never compare wall and document metrics as identical. Repeat matching logs show6 cache hits with0 provider reads for accepted project; initial cold read verified6/6 without failures. Enquiry warm GET phases: auth43ms, identity24ms, mail396ms, matching69ms, final access49ms, identity33ms. Background refresh mail6943ms remained separate from saved display. Goal target still unmet, cold-instance reuse not solved. No shared persistence selected yet.

Builder verified Commercial-to-Overview return, timestamp, source link and message disclosure on corrected preview. Reviewer could not access an independent browser this time (IAB unavailable); no independent rendered proof claimed. Ordinary-staff live proof remains owner-deferred. Name-cell measurement attempt opened an editor, exited with Escape without edits; actual measured journey uses row Open link.

Velt PR380 dd19d3e was explicitly approved, merged32ff63cad073fd5ca029673793edd92c103021fd and promoted to dpl_6WaoZ6gX9hWaW7NeHaPEg8K6N7iW. Actual staff-summary syd1 placement and live health verified. Rollback actual prior public service dpl_GPVBNDixT4g7CnR8CzFWhSWNPAp8. This release does not authorize Portal PR153.

Next increment: actual fabc0c8 hosted artifact reveals Portal project page/correspondence still in bom1 (Mumbai), unlike the Sydney database and receiver. Added narrow syd1 rules for project page, snapshot, summary, Command Centre and correspondence only; hosted placement/performance verification pending. This evidence changes priority before adding shared-cache persistence. Existing Next data caching is forbidden. Final first-time sample on fabc0c8: additional enquiry11506ms, saved repeat2341ms; GET with no saved context (no matching/final phases) followed by POST7008ms mail phase confirms first-time read. Runtime evidence email-speed-final-first-runtime.jsonl. CI35199370831 confirmed still running Portal Vitest and five performance runs. Latest turn made implementation and measured progress, not a blocker. Goal remains active.

Placement trial outcome:68c87d2 deployment dpl_BWTAdVQm3RkHEJm2RCyYPkjhVDiP verified all five requested functions in syd1 and unrelated work command/Xero observer still bom1. Independent config review passed. Real same saved-project loads7237ms then5122ms were worse; Portal identity/final-access phases rose to247–624ms versus24–70ms, despite mail phase339–371ms. The assumption that Portal database shares Velt database locality was not established and is contradicted by measured round trips. Restored protected alias to tested fabc0c8/dpl_CTkhwBmidDvvS5CymwLMZZ2YhKiC and reverted only the trial config. No public production change. Preserve separate service/database locality evidence. Goal remains active; first-time/saved proof improved, proposed placement rejected by actual measurement.

Private evidence: Portal `.codex-tmp/clarity/email-speed-phase-runtime.jsonl`, `email-speed-firstload-runtime.jsonl`, `email-speed-*-tests.log`, `email-speed-mount-push.log`; Velt `.codex-tmp/staff-region-check.log`, `staff-region-inspect.json`. An attempted read-only audit metadata helper could not retrieve non-decrypted Vercel sensitive configuration; no secret output or broadened access. Do not retry via unauthorized mechanisms.

**LIVE — 17 September 2026:** PR145 merged as e8894d98b497f3dc0da7e3de80b3b4013e8e56df after every required check passed on9463cd8 (Quality35190777456). The only correction after reviewed8a9275d was browser assertions/docs;83 focused project-page browser checks also pass locally. Production portal.sanctuarypergolas.co.nz resolves to Ready deployment dpl_93wirCt9Vmp3zesX7AghYh29bu78 from the merge. Correspondence, lineage and snapshot settings are enabled for production. Reviewed candidate was briefly promoted before the main deployment took over automatically; no unreviewed application change. Migration000002 installed with115 audited cadence cancellations, zero active cadence and one active manual item. Builder verified live customer emails, latest/history expansion, accepted Q-0206v5 and return to Overview; refreshed email timestamp observed. Unsigned project access redirects307 to login. No customer emails sent or bulk backfill. Rollback app deployment remains dpl_Fg3yVgxuDqphHFNUTWmErkg1g3Ew; retired business cadence must not be restored implicitly on application rollback. Ordinary-staff live confirmation remains outstanding, explicitly moved after release by Jordan. All earlier pending-release/pre-release staff-gate statements are superseded. Private receipt .codex-tmp/clarity/portal-production-release.json; this final owning-doc evidence is local after the merge and is also reflected in PR145's release body.


## Active staff project clarity goal - 16 September 2026

### Current focus: useful workflow before release

**Production retirement installed — 17 September:** exact approved000002 installed successfully through guarded transaction; zero active cadence, one manual task retained,115 audited cancellations independently counted. Private receipt: .codex-tmp/clarity/follow-up-production-install.json. UI promotion has not occurred. Quality35189319351 failed five stale browser wording assertions (four compact Owner labels and one relocated source caveat); corrected assertions pass locally and preserve the same business checks. No application code changed. This supersedes earlier statements that000002 is not installed. Ordinary-staff live testing is explicitly post-release per owner decision below.

**Release amendment — 17 September, after staff finished for the day:** Jordan explicitly authorized production rollout and moving ordinary-staff verification to live testing afterward. This supersedes that pre-release human access gate only; automated/security gates remain mandatory. No role changes or fabricated staff-session proof. Release application 8a9275d after current Quality gate passes, install the prepared exact retirement migration, enable the approved correspondence/lineage/snapshot settings, merge PR145 and verify production. Ordinary-staff live confirmation remains outstanding after release.
**Release authorization — 17 September:** Jordan accepted the revised email reader and instructed "go ahead" with remaining checks, merge and production rollout. This authorizes the prepared release once readiness gates pass; it does not waive actual non-owner staff access verification. Current application revision is 8a9275da5c86181c9ade5ae394918f73375700e3, protected candidate dpl_9bgU6XYb1cBPo3XxE8k34osJGALk. PR145 is mergeable against e5578a3; Quality and Performance run35189319351 remain in progress. Exact retirement migration hash remains e5df19bf48e3a6cb780e40d9d58e2a4b8c94425248ca63b06fd365b5670fb395. No production mutation or promotion occurred. Available CI credentials are for existing automated testing, not verified production staff access; production provisioning is forbidden by the auth guide. Asked who can complete the existing protected-preview staff read test; no owner re-login or role change requested. Previous pending visual-acceptance statements are superseded by this owner acceptance; staff-access gate remains unresolved.

**Email reading correction — owner approved 17 September:** owner rejected the
uniform expanded thread and unhelpful opening-word preview. Owner explicitly
declined a new AI summary after considering it. Approved deterministic useful
preview, newest message before older quoted text, identifiable quoted headers,
bounded reading panels, full wording/source preservation. Published for protected review;
26 focused parser/component tests and 7 browser journeys pass, including nested
history disclosure. Independent review verified desktop/390px and keyboard
disclosures, and caught ambiguous greeting/sign-off removal in previews. Those
cases are now preserved; signature removal requires literal sender-name evidence
from the email address. Independent recheck passed (9 parser/preview tests). Revision 8a9275d is Ready in protected deployment dpl_9bgU6XYb1cBPo3XxE8k34osJGALk on the existing review alias. Builder verified real desktop and 390px latest/history separation, nested disclosure, original Outlook links, and keyboard scrolling of a 1061px quoted body inside its 480px pane (scrollTop 420). Unsigned access remains 302; pre-push checks pass. Hosted Quality/performance checks remain pending; other gates pass. Conservative matching retains uncertain greetings/signatures. Public production unchanged. This final evidence update is local only. No AI-generation behavior changed.

**Finishing pass — owner approved 17 September:** compact the idle work panel,
put commercial metrics before quote history, and format currency to two decimals.
Implemented without changing business state or assigned-work/delivery controls.
Quote history is an accessible closed disclosure below the metrics.23 focused
tests and7 desktop/mobile fixture journeys pass; mobile visual inspection confirms
the compact row brings the customer message higher. Architecture checks pass.
Revision296d5724776abd44629a5d8123e5c9a475af47fc is Ready in protected deployment
dpl_97V2nGwqpdwtrYnRmmGFejXCBbcM on the same review alias. Full pre-push types/lint
pass. Builder verified real desktop/mobile layout, exact two-decimal price,
history disclosure/link, and opening/closing work controls without writes.
Unsigned access remains302. New hosted Quality/performance/reader-denial checks
remain in progress; other current PR gates pass. Public production unchanged.

**Focused polish — owner approved 17 September:** owner accepted the revised
page as much better and agreed with8/10 presentation, then requested only repeated
explanations, cramped headings and boilerplate previews be improved. This closes
the prior broad visual rejection; focused polish is now implemented locally.
Association caveats remain once per unconfirmed group and in the details disclosure;
conflicting-project warnings remain per message. Known generated quote/invoice
previews retain their original leading summary; full text and source links are
unchanged. Project headings wrap.36 focused tests and7 fixture browser journeys
pass. Full pre-push types/lint pass. Final revision fae5285 also gives the title
its own row; long-name desktop/mobile inspection passes. Protected candidate
dpl_97M9bkjkLtMhEr4bRt9KxmeqSTA5 is Ready on the existing stable protected alias;
its receipt is in the existing private clarity artifacts. Real accepted project
inspection confirms readable full heading, reduced explanation text and the
single-sentence invoice teaser; expanding still shows the original full email.
Unsigned access302 and existing signed-in session verified. Hosted CI for this
new revision is separate from the previous green191015e gates. Non-owner
staff verification and conditional production release remain outstanding.

**Owner visual correction — 17 September:** Jordan's screenshot rejects the prior
presentation: stretched gap between left work/commercial sections, unexplained
accepted-version warning, dense correspondence and weak typography/hierarchy.
Earlier sample8/10 is superseded as readiness evidence; release remains paused.
Local revision pins work-row height, makes customer reply primary, separates
subject/sender/date, uses compact whitespace-normalized previews with full text
available, and adds a neutral current-agreement/history explanation. Independent review
identified that older accepted statuses are deliberately retained under the
commercial policy; the earlier warning was misleading. No correction chore or
accepted-record change is appropriate. View quote history remains available. New accepted-review
synthetic fixture reproduces long correspondence plus multiple accepted versions.
Seven browser journeys pass, including <=24px gap before/after email expansion and
390px overflow check.20focused component tests and Portal types pass. Independent
visual/wording review completed: the misleading warning finding is closed.
Final preview revision `191015e2494dfb2e9a790efe8c2d0ca96267b296` also removes
quoted-history headers from compact email teasers without altering full messages;
two focused tests and independent source review pass. Ready protected deployment
`dpl_G6VWjwcTusYYNYdztC8RHEcUcy8D` is assigned to the existing stable review alias.
Builder verified the signed-in real accepted project, compact reply, full-message
expansion, normal section spacing and neutral current-agreement note. Unsigned
access remains HTTP302. No new sign-in was needed. Current hosted reader-denial
checks, the five-run performance report and Portal Quality all pass; public
Portal is unchanged. Independent live staff-session testing remains unverified.
Owner review and the wider release gates remain outstanding; this is not goal completion.
Performance scope: downloaded current five-run artifacts to private
`.codex-tmp/clarity/performance-191015e`. Cold project useful content appeared in
1973–2109ms; background settling took5110–5616ms. All five met regression budgets
but reported productTargetMet=false. Passing CI is not proof of all speed targets
or ten-second human comprehension. Final Quality35185388980 completed successfully,
including fixture/browser and authenticated smoke gates; all PR145 checks pass
on191015e. Watcher41127 exited0; no run remains pending.
Continuation evidence on191015e: builder rechecked the real quote-stage project,
opened exact current Q-0228v2 and returned to decision-outstanding Overview without
a mutation. Real new-enquiry page displayed current owner and readable saved
customer correspondence with unconfirmed association clearly retained. Accepted
project restored for owner review. CI watcher session41127 tracks existing
run35185388980; do not restart the run on observation timeout. Previous goal turn
was progress (UI corrections and real-preview evidence), not a blocked turn.


**Current checkpoint — 17 September 2026**

The correspondence reliability backend is live. PR378 installed Velt migrations
202609170002–004 after rollback-only rehearsal; PR379's exact approved ed0635b
merged as ea0ba1de60e387b64e72a2e3b2123885628debe0. Ready deployment
 dpl_GPVBNDixT4g7CnR8CzFWhSWNPAp8 is verified on velt.systems. Rollback deployment:
dpl_FH61srDRmeb7cbhZcdNMx7C7c1Ts. All backend hosted checks and independent code
review passed. Private receipts live in Velt .codex-tmp/staff-reliability-release.json
and staff-mail-payload-release.json. No customer emails were sent.

Real enquiry, quote and accepted projects now show saved correspondence. The
accepted reply expands readably; returning from another project retained its
checked time without another audited Outlook read. Root verified its exact
accepted quote v5 and mobile Overview return. These are builder-operated live
checks, not independent staff usability testing. The original 256KiB provider
response limit was proven by safe diagnostic HTTP200/587ms/response_limit and fixed
with customer-only bounded2MiB ingress, preserving 100KB total/32768-unit excerpts.

Integrated Portal b2e7b74 includes production main e5578a3 and PR150 owning-doc
release evidence. Full local types/lint passed on push; 97 browser checks passed,
one skipped; 33 integration tests and 23 independent presentation tests passed.
Protected candidate dpl_EdDdnY25sRUYrbmHCqTCmFtPp1mR is Ready and assigned to the
same protected review alias. All hosted checks passed at b2e7b74, including Quality/Performance35183714821. The
background jobs PG17 download was rate-limited by its registry; failed-job rerun
35183714831 passed. Integrated protected candidate retained login and real mail;
unsigned access302 goes to Vercel SSO. Public Portal unchanged.

Independent delivery reviewer inspected populated enquiry/quote/accepted fixtures,
390px layout and keyboard/disclosure behavior. No material UI defect found. Its
separate browser session cannot access the signed-in real preview; independent
live execution remains unavailable. Preserve this limit rather than calling the
whole goal8/10. Public Portal UI and follow-up retirement000002 remain unreleased.

**Retirement release preparation:** live read-only preflight on iytanftukulcnavossmd
confirmed002unused,006/001/003/004installed,82lead+33quote cadence items and one
manual item. Exact migration SHA256 e5df19bf48e3a6cb780e40d9d58e2a4b8c94425248ca63b06fd365b5670fb395
passed rollback-only live full-schema apply/replay:115retired,1153otherwork rows
unchanged, exact audit count and confirmation history preserved. No installation
occurred. Script .codex-tmp/clarity/follow-up-live-rehearsal.sql; independent release-safety review closed after two focused proof corrections.
Rehearsal additionally verifies exact per-item before/after audit events, unrelated
repair preservation, repair receipts, existing ACLs, and trigger table/function
bindings; missing rows/functions fail closed. Live repair branch has zero rows,
so synthetic tests remain its evidence. Guarded installation script prepared at
.codex-tmp/clarity/follow-up-install.sql with exact hash, four function preimages,
two new-guard absence checks and atomic ledger insertion. NOT executed.

**Owner decisions and boundaries**
- Retire unused sent/reply recording and automatic cadence; retain real manual
  work, commercial history and specialist tools. The genuine sent/reply outcome
  test is superseded by Jordan's explicit retirement decision (task messages,
  17 September). Never fabricate a business event to test it.
- All staff may read correspondence. Historical emails without reliable saved
  identity stay readable as project match unconfirmed; Jordan explicitly chose
  no manual linking or tracking task on17 September.
- No automatic sends, default AI interpretation, inferred acceptance, bulk
  backfill, access bypass or repeated sign-in requests.
- Keep the fixed protected review origin below across revisions. Portal release
  remains conditional on readiness; receiver approval is revision-specific.

**Current versions and access**
- Sanctuary worktree sanctuary-project-clarity, branch codex/project-clarity-20260916,
  draft PR145; published application revision191015e2494dfb2e9a790efe8c2d0ca96267b296.
- Stable protected review: https://sanctuary-portal-git-codex-pro-2efc62-jordans-projects-43df95bd.vercel.app.
  Candidate dpl_G6VWjwcTusYYNYdztC8RHEcUcy8D has correspondence/lineage/snapshots
  enabled only for that candidate. Do not change global flags or public aliases.
- Public Portal remains dpl_Fg3yVgxuDqphHFNUTWmErkg1g3Ew from PR150.
- Velt release/rollback and current check status are recorded above.

**Evidence and remaining acceptance**

| Requirement | Current evidence and remaining disposition |
| --- | --- |
| Useful work/history | Unused sent/reply cadence controls removed; genuine work retained. Native concurrency/preservation proof passed. Follow-up migration20260917000002 still requires release installation. Earlier generic-stage retirement20260916000006 is installed with554 audited cancellations. |
| Real enquiry/quote/accepted mail | All three displayed readable saved results after PR379. Linked and unconfirmed messages stay distinct. Latest accepted reply expands. Revalidate integrated candidate before final release. |
| Commercial truth/return | Real accepted quote Q-0206v5 opened and Overview returned at390px; owner, accepted price and deposit/uninvoiced distinctions preserved. Prior quote/enquiry evidence retained in private artifacts. |
| Reliability | Cold real reads publish snapshots; return reuses same checked time without another Outlook operation. 15min reuse/24h ceiling/60reads-hour approved. Native17DBtests, lifecycle tests, expiry and denied-access fixtures pass; live outage recovery not deliberately induced. |
| Desktop/mobile clarity | Independent three-story walkthrough and390px keyboard/disclosures passed. Real390px title/owner/reply readable; accepted quote/return verified by builder. Agent observations do not establish human ten-second task performance. |
| All-staff access/security | Route requires staff/project access, never owner role, and rechecks before delivery. Auth/denial tests pass; actual non-owner session journey remains unverified. |
| Independent review | Latest review caught and closed the false accepted-version warning; desktop/mobile layout and final compact-preview source review pass. Real signed-in session unavailable to reviewer; no independent live claim. |
| Release/handover | All hosted gates pass on191015e, including completed Quality/Performance35185388980. Fixed protected preview retained. Production UI and000002 migration not released. |

Earlier owner feedback rejected the spacing, warning and correspondence display.
These findings are addressed in191015e; renewed owner usability feedback is pending.

Next action depends on owner usability feedback on the revised preview and a
real non-owner staff correspondence session. These gaps have persisted across
more than three continuation turns; with CI now complete, no remaining automated
check can establish that human acceptance. Goal is blocked on this input/access,
not complete. Do not fabricate evidence, change roles, or request another owner
sign-in. Resume bounded retirement installation/release only once readiness is
established. The existing installation rehearsal and exact script remain prepared.

Provider basis for the implemented identity resolver:
https://resend.com/changelog/message-id-for-sent-emails and
https://resend.com/docs/api-reference/emails/retrieve-email distinguish the stored
API ID from RFC message_id. The original package review passed19 focused tests;
provider suite66, jobs172 and worker162 passed before later Portal integration.
These remain synthetic evidence, not proof of live credentials or historical
provider retention. No send, persistence or bulk backfill is added.
**Owner scope amendment, 17 September (task messages after real-email review):**
Jordan confirms that sent/reply recording and its follow-up workflow have not
been used, are not useful, and should be deferred until the rest of the Portal is
used. Remove those controls and automatic follow-up prompts/reminders from the
active workflow while preserving history. This supersedes the earlier requirement
to keep manual recording secondary and to exercise a genuine sent/reply outcome.
Do not ask Jordan to supply a business event to validate this retired workflow.
Any future reminder must justify its purpose, evidence, owner, useful action and
resolution. Preserve genuinely assigned manual commitments and specialist tools;
do not replace removed cadence with invented next steps or generic triage.
Acceptance now centres on understanding the job, reading relevant correspondence,
opening the correct quote/design/files/original email, and returning accurately
on desktop/mobile across real enquiry, quote and accepted examples. All-staff
access, commercial truth, history, privacy and conditional release gates remain.
Current next action: complete hosted browser checks for the implemented retirement
and automatic correspondence read, then verify the protected real journeys.

Local implementation checkpoint: sent/reply controls are removed, stale API
recording requests return410, and cadence is filtered from shared work readers.
No-work pages now display the project owner instead of inventing a next action.
The local quote story was opened and confirms those controls/prompts are absent.
Migration `20260917000002_defer_project_follow_ups.sql` is drafted, NOT installed:
it removes enquiry creation, makes quote reconciliation receipt-only, cancels
active cadence with events, and retires cadence repair signals with before/after
receipts. Independent review found missed repair signals and a concurrent-producer
race; both have local corrections, with project-first write fences and immediate refusal (NOWAIT) on concurrent writers.
Native PostgreSQL17 concurrency proof and independent recheck pass: conflicting
project-row and advisory writers cause immediate migration refusal, both staff
transactions survive, and a later retry retires with audit. Replay and reopening
rejection also pass. Twelve PGlite tests cover all five retired recording types,
preserved manual work/correction history, queue selection and grants, plus quote
version/project binding and receipt replay for SENT/RESENT/OUTCOME. The broader
work-domain/UI suite passes 120 tests; Portal typecheck passes. Private native
repro: .codex-tmp/clarity/follow-up-native-proof.mjs. Independently reviewed SQL
SHA-256: e5df19bf48e3a6cb780e40d9d58e2a4b8c94425248ca63b06fd365b5670fb395.
Correspondence read-on-open and mobile anchor clearance are published in afb32ef. Real protected `ecdd68f` quote/open/return passed desktop/mobile and
original Outlook access was verified after Jordan signed in. Hosted Portal
Quality on that preceding revision failed obsolete fixture expectations (multiple
email excerpts and moved recording controls); update those tests with this batch.
Shared queue no-work/repair behavior is corrected locally. Remaining work includes hosted browser verification, full release checks and
independent protected real-journey review. No retirement was applied live.

Revised synthetic UI delivery review passed independently for enquiry, quoted and
accepted jobs at desktop and390px mobile: readable sender/date/text, keyboard
message disclosures, correct proposed/agreed distinction, retained installation
commitment and no retired recording controls. Scoped clarity/visual/correctness
met the review threshold; wide desktop whitespace is optional polish. This is
sample evidence only: disabled controls and sample source links do not prove the
protected real journey. Root also checked all three mobile/desktop stories and
full-message expansion. The local server at127.0.0.1:3025 remains the sample view.

Current checks:408 Project Work tests (including12 retirement database cases),
workspace types/lint, docs guard and changed-architecture report pass. Native
concurrency and UI reviews are separate evidence. The two browser specs have been
updated for absent recording controls and multiple visible emails; their new
hosted execution remains pending. The large command-centre spec shrank by removing
retired expectations; further decomposition is deferred to avoid unrelated test
restructuring. The schema/auth/automation owner docs now reflect this amendment.

Publication checkpoint: integrated revision `8f19542` is pushed to draft PR145
after required pre-push checks passed. It includes the quote-binding correction
and current main010f8f0. Exact-head Portal Quality run35167031811 is active;
preceding UI revision afb32ef run35166475218 finished with93 browser checks passed,
one skipped and one obsolete expectation failed: it still required a manual
Check conversations click before reading. The corrected test asserts GET access
before automatic POST read, no AI payload, no repeat read on visibility return,
and removal of evidence after a denied refresh. Its hosted rerun is pending.
Protected candidate dpl_8BMddLcsU7rHwHvm1Z1SancLswzu is READY at afb32ef
exact revision and its project route was opened at Staff Login. Jordan has been
asked to sign in; the latest browser observation still shows Staff Login.
Do not copy credentials/session tokens from another origin.
Reuse private receipt protected-candidate-afb32ef.json and the existing handles.
The published migration correction restores required quote version/project
binding before reconciliation receipts; independent12-test review passed.
A git diff confirms no Portal/package runtime change from protected afb32ef to
integrated8f19542, so reuse that protected preview for real-journey proof. No live migration, custom-domain promotion or global
flag change occurred. The preceding ecdd68f candidate retains the older UI.

External state check: current Portal production is010f8f0 (marketing-only PR148
since branch base874f898); current Velt is1511220 (marketing-analysis PR374 after
reviewed receiver releasec1f6c28). Compared file lists do not alter these project
or correspondence owners. Current main010f8f0 is integrated; recheck external main before production promotion;
do not roll either application back to an earlier whole-repository revision.

Sanctuary branch `codex/project-clarity-20260916`, PR145, published base
`8f19542` integrates main `010f8f0` after reviewed UI batch `afb32ef`. Earlier checkpoints below are historical; this section is current.

- **Verified real correspondence:** the signed-in protected Portal returned six
  customer-address-matched emails with readable text, sender/date and source
  links. The latest quote email agrees with the canonical current quote. Address
  matching does not establish that every email belongs to this project. No AI
  request, customer send, outcome write or bulk backfill occurred.
- **Released backend fixes:** Jordan separately approved Velt PR372 at `8c080fa`
  (merge `63d6845`), reporting migration `20260917000001`, and Velt PR373 at
  `90cae9d` (merge `c1f6c28`). Permissions are scoped to those releases. Exact
  hosted checks passed. Current Velt deployment is
  `dpl_34kwXeAMCZiQUnb96nDbY6Ne5Ndt`; login200, unsigned-staff403 and alias
  postflight passed. Rollback is `dpl_7J3CcLTQXPyZ5x82wXeABitnaaDY`.
- **Verified reporting installation:** migration SHA-256
  `80feea41007c8eb407a9dfa1f20a34846cbdc2a458a23e782837850c374c629e`;
  native/Docker PostgreSQL17 and PGlite boundary regressions passed. Guarded live
  rollback rehearsal covered14 selected-project records with zero entry/byte
  violations. Independent postflight confirmed body/ledger hash and unchanged
  grants/helper. Private receipts remain under ignored `.codex-tmp/clarity/`.
- **Verified access-link protection:** fresh real email expansion shows the
  removal marker and no token query parameter. Original Outlook links remain.
  Protection is pattern-based, not universal DLP.
- **Verified historical cache removal:** private Support ticket is closed;
  GitHub confirmed garbage collection/cache clearance. Unsigned commit/raw-file
  checks both return404. Ignored receipt retains the incident evidence. Do not
  publish customer data or historical revision references.
- **Local email UI independently verified:** latest mail and latest exact-customer
  reply are featured; older mail is secondary; complete identical copies group
  without losing source links. Exact subject quote references are labelled as
  references, never acceptance. Reading state survives successful access refresh
  while private text remains hidden during authorization checks. One rendering
  defect was corrected and independently rechecked.
- **Superseded action design:** the earlier email shortcut and secondary manual
  tracking controls were reviewed at the time, but the owner explicitly retired
  this workflow. Those earlier checks do not establish the revised UI's readiness.

Latest verification checkpoint: browser correction `017a527` is pushed and its
exact-head Portal Quality run35167757041 is confirmed running. All14 correspondence
lifecycle tests pass; changed-architecture and required pre-push checks pass.
Reuse that run rather than starting a duplicate. Protected afb32ef remains the
same Portal runtime; only tests and this record changed after integrated8f19542.

Continuation checkpoint: updated protected preview remains at Staff Login after
repeated checks across more than three goal turns. Useful older-runtime enquiry
and accepted baseline checks are complete; revised real journeys, association
and independent delivery acceptance require the updated authenticated session.
Goal blocked on that sign-in, not declared complete. Existing CI run35167757041
continues (only Portal Quality remained pending at last check); watcher session4035
and ignored automatic-read-browser-watch.log retain its handle/output. On resume,
inspect that same run and candidate session, do not restart or deploy a duplicate.
No production release, retirement migration or global flag change has occurred.

Association audit: the current message grouping features the newest email for the
customer and the newest incoming customer email, regardless of project. A current
quote reference in the subject gets a factual reference label, but does not change
group selection or establish association. The customer-only caveat is accurate;
it does not satisfy the latest-relevant-project-message acceptance requirement by
itself. Real multi-project evidence must resolve this before release; do not infer
association from address alone or treat a passing browser suite as proof of it.

Real enquiry baseline is now available through the earlier authenticated preview:
an actual new enquiry has a current estimate, named owner, incoming customer reply
and outgoing staff messages with sender/date and Outlook links. Its old first-email
reminder contradicts that correspondence, reinforcing the requested retirement.
Private case locator/evidence: .codex-tmp/clarity/real-enquiry-baseline.txt. No AI,
send or outcome write was invoked. This identifies the next real enquiry case;
it does not verify the revised automatic read/layout on the protected candidate.

Real accepted-project baseline also identified on the older authenticated preview:
current accepted quote, older accepted versions, recorded partial payment and
remaining amount to invoice are distinct. The current quote opened at the expected
accepted version and browser return restored that version and owner. Correspondence
includes the same current quote reference/version, an older version, incoming
customer replies and invoice emails. A separate deposit-stage record has no saved
accepted agreement: stage alone must not imply commercial acceptance. Private case
locators: .codex-tmp/clarity/real-accepted-baseline.txt. These are desktop baseline
facts, not revised-preview/mobile acceptance or proof of every email's association.

Remaining: finish the revised fixture browser matrix and final delivery review, then complete real
project association and enquiry/quote/accepted journeys on desktop/mobile with
independent review. No sent/reply recording outcome is required. Overall 8/10 is
not established; global Portal correspondence remains disabled. Backend release
approvals remain scoped to their specific changes.

### Earlier implementation checkpoints (superseded where noted above)
Hosted-empty-POST correction is published as `a0cbecf`; full pre-push workspace
types/lint and changed-architecture guard passed, as did independent review and
30 focused route/gateway checks. Its separate protected deployment is READY;
unsigned staff reads remain 401, project-wide feature flag is unchanged and no
custom domain was assigned. Private receipt is
`.codex-tmp/clarity/protected-candidate-a0cbecf.json`. The new deployment has a
separate login session: Jordan has been asked to sign in to repeat the real read.
17 September status check: exact-head Portal Quality `35069297341`, Portal
Performance Report and Autonomous Engineering Foundation all passed. Jordan is
signed in to the corrected preview; the first corrected real correspondence read
is being verified. Do not equate these automated passes with whole-goal acceptance.
The earlier protected candidate below is superseded and retains the empty-POST
bug. No live Portal release or positive customer-mail result is yet claimed.

The first protected candidate was `0620180`, incorporating production main `45cc09f`; local
documentation now records its subsequent verification. Prior goal turn was progress (private Support request
submitted, current main integrated and verified). Exact-head Portal Quality
`35068357748` is running; reuse that run. A separate production-configured test
deployment is READY at the exact candidate revision, with correspondence enabled only through deployment-local
overrides. Project-wide Portal flag remains false, custom-domain assignment is
disabled, and the live Portal alias remains its prior release. Vercel protection
is `all_except_custom_domains`; the candidate URL therefore remains protected in
addition to normal Portal staff authentication. No customer data is embedded in
the build or public evidence. Private metadata receipt:
`.codex-tmp/clarity/protected-candidate.json`. This candidate is for read-only real
message verification before any live Portal promotion or consequential outcome.
Browser inspection reaches the normal staff login; an unsigned Portal API read
returns 401. Jordan signed in on this separate protected origin. The actual staff
journey then exposed a hosted-request bug: GET availability is 200, while an empty
POST receives 400 before reaching the correspondence gateway. The route treated
any non-null body stream as supplied data. The fix inspects bytes instead, accepts
an empty stream and immediately rejects any content regardless of Content-Length.
Thirty focused route/gateway checks pass, including empty-stream and forged-length
regressions. Independent review reran all 30 checks and found no material defect;
auth, origin, project authorization and signed identity are unchanged. No positive
real email read is claimed.
The original candidate stays unpromoted. Deploy the reviewed correction to a new
protected candidate and repeat the real authenticated read before live release.
Velt's live receiver has advanced to `26f899f` through the owning tasks; ancestry
includes the reviewed staff release and its staff runtime/endpoint are unchanged.

Latest release checkpoint, 16 September: PR365 merged as `a53f4ed`; its migration
`202609160005_customer_journey_reuse.sql` is independently verified installed.
The staff migration moved byte-identically to `202609160006`. Staff HEAD
`27f6950` incorporates the actual squash merge and has the identical source tree
`9443c20ed13e410066d0250114aea42f4544d8b2` to independently reviewed `ef9d0a6`.
Thirty focused independent checks and all 13 native PostgreSQL tests passed;
hosted CI `35064722149` and exact-head CI `35065342869` passed. Portal Quality
`35063262127` and Background Jobs retry `35063262169`
passed, and all PR145 checks are green at `d972e62`.

Production setup: both projects have the dedicated vault-held signing key;
Portal's receiver is the verified `https://velt.systems` domain. Initially both
flags were false. After a rollback-only live-schema rehearsal, staff migration
006 was installed on the exact Velt target. Postflight confirms its ledger entry,
zero staff requests/events and unchanged Connections/Outlook stop/generation.
Recovery is keep/restore the false flags and preserve additive tables and audit;
never remove history to roll back the feature. Private receipts are in Velt's
`.praxis-evaluation-private/staff/{dark-env-receipt.json,installation-result.log}`.
Independent postflight passed exact ledger/RPC hashes, grants/RLS, immutable
audit and unchanged provider authority. Velt PR366 then merged as `01c99c4` after
exact-head required checks and clean mergeability. Its enabled candidate
`dpl_4L5H6xbT1XVneTuq1xM6WisuJ1JT` passed protected-deployment login (200) and
unsigned-request denial (403), then was promoted after checking the live alias
still named the previous PR365 deployment `dpl_4MSqgTV58MGQAfXaaBgVEMcaeS3X`.
Postflight verifies `velt.systems` points to the candidate, login is 200 and the
unsigned endpoint returns 403 with private/no-store caching. The previous release
is the rollback target. Velt's receiver flag is now true; Portal's flag remains
false. No positive staff request, real correspondence or Portal rollout is yet
proved. Candidate metadata: Velt `.praxis-evaluation-private/staff/enabled-candidate.json`.

Sanctuary retirement migration is now **installed**. The live-schema rollback
rehearsal passed apply/replay, exact event-count and unchanged meaningful-work and
history assertions. Installation then checked unchanged function hashes and the
unused ledger slot before changing records atomically: 554 generic reminders
were cancelled with 554 before/after audit events. Active enquiry follow-ups
remain 76, quote follow-ups 33 and manual work one. Independent read-only postflight
passed ledger/function hashes, all 554 before/after events and unchanged meaningful
work counts. Private receipts: `.codex-tmp/clarity/retirement-before.json`,
`live-retirement-rehearsal-result.log` and `retirement-install-result.json`.
Application rollback does not erase these audit events; restoring retired work
would require a separately reviewed, audited recovery rather than deleting history.

Publication correction: customer-specific commercial evidence was accidentally
included in the final progress-note commit on this public draft branch. That
single documentation commit was replaced with a redacted revision using an exact
lease, preserving PR145 and all implementation; the affected revision was not
merged to main and is absent from the active PR. Historical GitHub retrieval is
still possible. Jordan approved the private Support removal request; it was
submitted successfully and is open awaiting GitHub's response. Its ticket receipt,
references and draft stay in ignored
`.codex-tmp/clarity/github-cache-removal-request.txt`; do not reproduce customer
details or the removed revision in public progress notes. Current clean PR head
is `e58ec2d`; Portal Quality `35066673540` and all exact-head required checks passed.
Portal is still unreleased; this does not prove the real correspondence journey.
The superseded revision's
remaining CI was cancelled deliberately after replacement.

Release preparation then incorporated production main `45cc09f` (marketing reader
PR146) without conflicts, preserving its routes, reader, tests and workflow.
The combined focused marketing/auth and correspondence gateway slice passed
21 tests; the opt-in cross-repository pairing check skipped because its explicit
pairing setup was absent in this invocation. Prior pairing evidence is unchanged;
this is not a new live integration proof. Required hosted checks must pass on the
combined revision before release. Velt's owning task is separately releasing its
clock correction and marketing work; do not overwrite its deployment window.

Real browser baseline: authenticated production access is available. On the
selected quote-decision project, the current-quote link opens the exact sent
version and returning retains the correct amount, owner, status and follow-up.
The read-only journey passed on desktop and a 390px mobile viewport; the viewport
was restored. Private identifying evidence is in ignored
`.codex-tmp/clarity/real-project-baseline.md`. No customer outcome was recorded;
acceptance would attempt an invoice email and is not a harmless verification click.
The selected customer has multiple project records, so customer-address matches
alone cannot establish project association. A separate deposit-stage example has
only an external quote in a team note and no canonical Portal quote. Preserve
that missing-data state. This proves existing production navigation, not the
pending UI or staff correspondence. Real message association, genuine outcome,
responsive acceptance and all three real scenarios remain pending.

Continuation evidence, 16 September: Velt's owning programme record in the
`velt-customer-journey` worktree now records two real customer reads, source-link
verification and owner acceptance; PR361/362 and production releases resolve the
earlier owner-reader dependency. Its subsequent latency work also changes the
shared orchestration: reconcile that current branch/main before releasing the
staff extension. Do not overwrite that task's checkout or duplicate its rollout.

Implemented locally: carry actual Outlook sender, sent/received dates and bounded
plain-text messages into the staff response independently of which quotations AI
selects. The Portal validates message IDs, freshness, address and Outlook links,
shows a short preview, and offers Read message for longer text. Credential-bearing
messages are withheld, byte-limit truncation is explicit, and customer-address
matches are still not asserted to belong to the job. No recipients or raw provider
payload are added. Ordinary reads now bypass the model, and the explicit Ask AI
action requests a fresh signed read with interpretation. Model configuration,
capacity or execution failure can return source evidence, while final context/mail
authority still fences delivery. Velt merged verified main `22a5ff5` through
`e6575ea`, preserving the released owner endpoint and its latency behavior.
Next publish/review this paired candidate and prove one real staff project.
Project-specific association, staff activation,
genuine outcome/return verification and all three real scenarios remain pending.

Verification for this increment: 25 Portal focused tests and 22 Velt focused tests
pass, including message rendering without AI citation, escaped source text,
credential omission, UTF-8 bounds, freshness and final authority rejection. Fixed
the missed layout-order assertion that failed Portal Quality at `39a8ac6`.
Velt types and focused lint pass. Local browser shows sender/date/source text on
the accepted-job sample. This is integration work in progress, not an 8/10 claim
or production activation. Incremental independent review caught an AI claim-capacity
failure that discarded already acquired source messages; recovery now covers that
case and its focused test passes. The same reviewer independently rechecked the
fix and found no remaining material defect in this increment (27 Velt/30 Portal
checks, then 11 affected checks after correction). Evidence:
`.codex-tmp/clarity/independent-staff-transport-review.md`. This does not close the
real-project outcome or authorize treating the staff feature as live.

Source-only continuation verification: native PostgreSQL passes 11 lifecycle tests,
including exact project context hash, missing/expired evidence, global stop/resume,
actor/audit and existing provider generation fences. Velt's focused journey/provider
slice passed 89 tests (four opt-in skips); the recovery addition and recheck passed
11 affected tests. Portal correspondence tests passed 43; both apps' types and
focused lint pass. Actual sender/receiver wire pairing passes one check in each
repository. No deployed staff migration/secret/activation or real staff read is
claimed. Previous goal turn was progress; this turn changes message-read behavior
and verifies its security boundary, with no repeated external blocker.
Fresh read-only Vercel environment metadata confirms neither production project
has staff correspondence signing/enablement variables yet; existing owner-reader
configuration is present. Provisioning is outstanding, not an unexplained missing
customer-data result. No credentials were copied to this record or tool output.

Published candidates: Sanctuary draft PR145 is now `d972e62`; its pre-push full
workspace types/lint passed, and Portal suite passed 673 files/3,858 tests with
12 skipped. Velt draft PR366 is `9d1df8b`, with full `pnpm run check` passing
(web 1,008 tests and 46 built-browser cases, plus other workspace packages).
Native PostgreSQL was separately exercised as above. Velt hosted CI run
`35063223380` was confirmed in progress; track it rather than starting another.
Next: inspect both exact-revision CI results, complete staff rollout preflight,
then activate the paired connection within the existing conditional permission
and verify a real staff project. Preserve the project-specific association,
genuine outcome/return, three scenarios and responsive acceptance requirements;
passing the transport candidate does not complete those. Neither draft is merged
or live, and the staff migration has not been applied.

Goal renewed in this task on 16 September after Jordan agreed with the revised
UI 7/10, understanding 6.5/10 and usability 6/10 assessment. First milestone:
one real project working end to end, then validation across enquiry, quote
decision and accepted/installation projects. In ten seconds staff should identify
position, latest relevant customer message, next useful action and responsible
person without explanation. Provide readable, correctly associated messages with
sender/date, optional cited interpretation, a concise summary and genuine work
actions. Verify opening the correct quote, recording an authorized outcome and
returning to accurate state on desktop/mobile. Sample UI and numerical ratings
cannot close this goal. Existing all-staff audience, conditional release approval,
no automatic sends/bulk backfill and remaining live-integration requirements stand.
Continue existing draft PR145 and this record; next action is to establish the
current live correspondence boundary and select a real project for read-only proof
before any consequential workflow change.

Owner correction after the first independent review (16 September, same task):
Jordan still found the page confusing, too information-heavy and could not find
correspondence. This supersedes the prior local usability/clarity pass as an owner
acceptance claim. The review checked labels and disclosures but missed the cost
of discovering the actual message. This is project feedback, not a universal
preference inferred for every interface.

Current correction: put dated source email excerpts directly in Customer emails,
deduplicate repeated citations, put AI interpretation behind a disclosure, retain
matching/excerpt limitations, collapse secondary contact/financial/history detail,
keep the price visible, and put emails ahead of financial details on mobile.
Shorten and compact the action area. No provider activation or fabricated sender,
full email body, task, or project association is introduced. Acceptance requires
visible message text without opening AI analysis, reachable secondary details,
desktop/mobile/keyboard proof and a fresh focused independent review; numerical
ratings alone do not close Jordan's usability concern. Production remains unchanged.

Correction verified locally: the same independent reviewer inspected all three
stories, desktop/mobile message visibility and contact/history/AI keyboard access,
and ran 19 focused tests. They caught a material regression where the compact
price could hide commercial warnings. Existing exception content now remains
expanded; the reviewer verified that fix. No further material defect reproduced.
Initial review plus one correction/recheck; owner usability acceptance remains
pending. Trial learning: the first review missed message discovery despite checking
disclosures; Jordan's intervention was necessary. The second review caught a new
exception-hiding regression before handover. No time/cost saving is claimed.
Evidence: `.codex-tmp/clarity/independent-owner-correction-review.md`,
`messages-first-*.log`. Eight affected browser cases passed after two assertions
were updated for intentional disclosures; the other 80 passed unchanged. Types,
lint and architecture checks pass. The 101-test Overview slice, eight card cases
and 14 commercial/Overview cases cover the revised local behavior.

Implementation approval: Jordan's "Go ahead, go ahead" in this task authorizes
the agreed workflow retirement and coherent examples. Current local batch adds
forward migration `20260916000006`, shared retired-work/capability guards,
purposeful email-recording explanation, saved-fact position headings and three
coherent read-only examples at `/qa/project-command-centre-fixture?story=enquiry`,
`?story=quote` and `?story=installation`. AI suggestions and agreement analysis
are disclosures, including customer-status interpretation. Existing
manual obligations and lead/quote follow-up remain; no automatic mail-derived
completion was introduced. Database rehearsal verifies cancellation/audit,
replay, future stage/import behavior, reactivation denial and paid-stage rules.
Local verification now passes: 671 Portal test files (3,841 tests; 12 skipped),
391 canonical work checks after correcting the retired-work queue expectation,
four migration rehearsal cases, six desktop/mobile story cases, affected Overview
regressions, lint/types, architecture ownership and isolated production build with
all six route bundle budgets. These are local checks, not hosted installation proof.

Independent delivery-review trial: one read-only reviewer inspected the exact
70-file R0 snapshot (manifest SHA256
`BF285B36784A4399C1B8DABE7631B748B174ED31E6698FBC3568C37747BB5695`),
all three working stories on desktop/390px, keyboard/source disclosures and the
no-obligation fallback, and independently passed 27 database/query/route tests.
Relevant local dimensions were assessed at 8/10 with explicit live-proof limits.
The review caught ambiguous collapsed agreement wording and an obsolete QA
seeding checklist. Both were corrected in one round and independently rechecked
on desktop/mobile; no overflow or collision was found. No mandatory defect remained.
Evidence: ignored `.codex-tmp/clarity/independent-delivery-r0-review.md`,
`independent-delivery-r0-tests.log`, and `delivery-r1-*.log`.

This is readiness of the local presentation/retirement milestone only. The
installation commitment and specific customer text are authored sample data.
Retirement does not manufacture real commitments, owners or email-derived work;
projects with no recorded obligation retain an explicit no-work/choose-next-step
state. Sample controls are disabled and sample record links are not live project
destinations. Hosted migration/queue parity, real-project action usefulness and
live staff correspondence remain unverified requirements of the wider goal.

Jordan accepted a milestone to improve the whole project story before deployment,
then requested an evidence-based review of actual workflow use and removal of
work that does not matter. Earlier local 8/10 assessments are **superseded**:
whole-page reassessment is UI 7/10, UX 6.5/10, understanding 6.5/10. Passing tests
did not establish coherent job guidance. Conditional production permission stands,
but the wider production-readiness condition is not yet met. Publish only for
review until hosted migration and real-project/integration evidence are established.

Acceptance: three coherent scenarios (new enquiry, quote awaiting acceptance,
accepted job awaiting installation), one useful primary action, current position,
attention needed and owner, evidence on demand, desktop/mobile review and at least
8/10 in UI, UX and understanding. Preserve the wider real-correspondence goal.

#### Production workflow usage audit, 16 September 2026

Read-only aggregate queries ran against `SP-Staff-Portal-DB` production project
`iytanftukulcnavossmd`, in `BEGIN READ ONLY` with an eight-second timeout and
ROLLBACK. No project/customer records were changed or email bodies retrieved.
SQL editor reference: `6a012361-b8cd-4b37-a619-bb10b7fcf240`. Figures cover retained
database history through this inspection; STAFF attribution is account activity,
not independent proof of business value or exclusion of every historical QA action.

| Recorded workflow | Evidence | Disposition for the next implementation |
| --- | --- | --- |
| First enquiry email confirmation | 73 confirmations / 73 projects / 2 accounts; latest 14 September | Used. Do not call it dead code. Remove dependence on duplicate manual logging only with a verified replacement or explicit cadence retirement. |
| Enquiry follow-up / quote follow-up | 9 / 12 confirmations; enquiry replies 8, quote replies 4 | Used but requires manual upkeep. Keep the business need to follow up; simplify the mechanism and expose the purpose. |
| Generic stage-review tasks | 554 open on ACTIVE projects; 535 overdue; 48 completed retained rows | Highest-priority retirement/replacement candidate. Stage alone should not manufacture an urgent staff obligation. Preserve history and address producers, queue and Overview together. |
| Lead reminders | 75 open ACTIVE, 59 overdue | Reconcile against real communication before classifying as missed work; overdue is not proof an email was never sent. |
| Quote reminders | 32 open ACTIVE, 17 overdue in final snapshot | Tie next steps to authoritative quote/customer evidence. Separate closed-project residue from actionable work. Counts can change during this live review. |
| Manual tasks and task management | 1 current manual work item; no retained STAFF block/unblock/reschedule/reassign/priority-change event groups returned | Little adoption evidence; keep secondary until a demonstrated operational need. Do not infer that the single item is a real commitment without inspecting it. |
| Close/archive/reopen/wait | 221 close events across 220 projects, 25 archives, 2 reopens, 1 wait | Preserve deliberate project outcome/exception controls. Low frequency alone is not grounds to remove recovery. |
| Site visit completion | 4 confirmations / 2 accounts | Preserve until authoritative Schedule/Site Visit integration can replace duplicate entry. |

Code trace: `project_command_confirm` in migration `20260729_000002` records
communication facts, completes the matching item and creates the next five-business-
day reminder. A reply cancels its cadence. It neither sends/verifies mail nor
advances the pipeline. `primaryAction.ts` currently ranks overdue open work ahead
of specialist actions, explaining how generic stage reviews can dominate useful
actions. The Dashboard and Work Queue consume the same work projection; deleting
only Overview buttons would leave the underlying problem intact.

Next authorized work: replace generic stage-review-driven guidance with meaningful
domain actions/explicit commitments, including producer/read-model/queue consistency
and non-destructive treatment of historic events. Retain used email-follow-up value
while reviewing how verified correspondence can replace manual bookkeeping; the
current on-demand summary does not yet provide that automatic replacement. No
workflow controls or production rows were removed during this audit.

Source: Codex task `01a0a7f8-d1c5-73c3-b810-20a01e469fed`, review and three
owner decisions followed by explicit goal/implementation approval on 16 September.
This section is the single working agreement and evidence record for this goal.

Outcome: staff opening a job can understand the current position, supporting
information, next action and responsible person without reconstructing its history.
Preserve the existing portal visual system and specialist mutation owners.
The owner approved a consistent layout whose priorities adapt to project stage.
Read-only linked conversations and labelled summaries may explain agreements,
open questions and suggested next actions; staff must confirm resulting changes.
No automatic replies or silent project/work changes are authorized.

Owner access decision (same task, 16 September): after explanation of the existing
owner-only Velt connection, Jordan explicitly chose access for **all Sanctuary
staff** to linked project conversations. This authorizes the audience; it does not
authorize credential sharing, bypassing connection consent/stop controls, or an
unbounded mailbox view. The staff-server read contract is implemented and tested
locally in both repositories; deployed verification remains pending. No separate
approval of the same audience is needed.

Permission updated by Jordan in this task after reviewing the preview screenshot:
"I am happy for this to be pushed to production if ready." This supersedes the
local-only publication/release restriction for this feature once readiness gates
pass. It does not authorize bulk correspondence backfill, automatic sends,
project-record mutation or unbounded model spending. Earlier approval-pending
entries below are historical; do not ask again for the same conditional release.
Branch: `codex/project-clarity-20260916`, worktree
`%USERPROFILE%/source/worktrees/sanctuary-project-clarity`, base `84c7e9f`.

| Requirement | Status | Evidence or next step |
| --- | --- | --- |
| Staff-first, stage-appropriate orientation and next action/owner | verified (local fixtures) | Primary work shows named owner and due date; explicit staff assignees and Unassigned are covered. Existing project owner remains in the responsive masthead. Stage, waiting, closed, archived, specialist and triage browser cases passed. Real staff acceptance remains pending. |
| Trustworthy agreement, design and payment facts | verified (local slice) | Existing staff invoice-schedule read, canonical amounts, unknown/error/access-loss cases and partial payment regression covered. Production/real-customer acceptance pending. |
| Clear estimates, quote versions/expiry and invoice presentation | verified (local fixtures) | Exact quote/source links, current accepted work, distinguishable unnamed estimates, historical accepted expiry and mobile financial records. Commercial journeys pass at 1440, 768 and 390px, including accepted quote detail and return. Real-customer acceptance remains pending. |
| Linked Outlook context and labelled summaries | implemented/unverified (both sides local) | Cited presentation, authenticated Portal route/client and signed Velt receiver. Actual wire pairing, nonce replay/concurrency, audit failure and global/provider stop fencing covered locally. Deployed runtime and real-customer evidence remain pending. |
| Staff confirmation of suggested changes | verified (local boundary) | No email-derived writes or send actions. Suggestions direct staff to the existing stage-appropriate Project Work controls; integrated real-customer confirmation journey pending. |
| Desktop/mobile and representative lifecycle/recovery/keyboard checks | verified (local fixtures) | All 75 extended browser scenarios passed together, including Commercial and read-only correspondence source disclosure. Six widths, keyboard, 200% equivalent layout, long text, recovery/access and close dialog covered. Real-data checks remain pending. |
| Evidence-backed 8/10 understanding and visual clarity | verified (local candidate only) | Baseline live review: understanding 4/10, visual clarity 6/10. Revised local fixture review: 8/10 in each; evidence and remaining limits below. Production and real-data acceptance pending. |
| Real-customer integrated acceptance | pending | Peter Harvey plus another customer; fixture success does not prove live integration. |

Review dimensions: correctness, usability, clarity, visual/accessibility,
wider-system fit, maintainability, recovery, privacy/access, performance and
handover. All are relevant; no new provider/subscription is proposed.

Ownership: this lane owns project Overview/Commercial presentation and narrowly
required summary reads/tests/docs. The customer-journey lane owns
`apps/portal/lib/praxis/**`, `apps/portal/app/api/praxis/**` and its reporting
migrations in `sanctuary-customer-read` / `codex/customer-journey-read` (PR143).
It has confirmed no Portal Overview edits. Its Outlook reader is in Velt,
bounded to exact email participants, 25 messages/180 days, text only. This lane
now supplies the separate authenticated staff endpoint in both repositories.
Live acceptance remains an integration dependency, not completed UI work.

The batches below are historical evidence, superseded where stated by the final
local review. They do not describe the current production state.

Local verification (16 September): `portal:doctor:quick` passed all documentation,
encoding, workspace type and lint gates plus 665 test files (3,796 passed, 11
skipped). Isolated production build passed with fixture-only environment and
`.next/clarity-build`; all six route bundle budgets passed against that output.
The normal build preflight matched another task's port-3094 development server;
it was not stopped. This worktree had no default dev/build lock, and its separate
build output avoided sharing that server's Next workspace. Next's incidental
tsconfig edits were restored. Logs are local under `.codex-tmp/clarity/`.

Rendered review: desktop and 390px mobile inspected through the browser. Work,
agreement and payment facts are legible; notes now fill space beside commercial
content. This is not the full 8/10 acceptance: email context, end-to-end staff
confirmation, estimate identity and Commercial browser review remain unresolved.
Existing large QuoteDetailView received only the bounded accepted-expiry condition;
its broader extraction remains outside this presentation fix. No new Supabase
table access, credential path, dependency or mutation was introduced.

Second local batch: Commercial presentation and correspondence prototype are
implemented. Browser evidence is `.codex-tmp/clarity/browser-extended.log` (75/75).
Mobile invoice records and expanded correspondence quotations were manually
inspected at 390px; no hidden financial columns or clipped source controls were
observed; supporting-source disclosure also opens/closes by keyboard. Second-batch
`portal:doctor:quick` passed: 667 files, 3,806 tests passed and 11 skipped, plus
workspace types, lint, documentation and encoding gates. Isolated production build
and all six route bundle budgets passed again. Ownership and diff-whitespace
checks passed. Evidence: `doctor-extended.log`, `build-extended.log`,
`bundle-extended.log`, `ownership-extended.log` under the same local log directory.
Build-generated tsconfig additions were restored; browser viewport was reset.
The customer-journey task returned a system safety error on its latest turn
("Potentially unintended activity"); no final acceptance result or actionable
cause was supplied. This lane has not retried its external operation.

Third local batch: the Portal side of the all-staff request is implemented but
disabled. The owning architecture doc records the exact proposed paired protocol.
The existing `requireStaffContext` and project read enforce staff/project access;
current role and project visibility are rechecked before delivery. No owner
session is forwarded. The browser requests availability first and only performs
the correspondence/model read after an explicit Check conversations action.
Evidence is not persisted. The final return-journey review below supersedes this
batch's original clearing-on-hide/expiry behavior. The signing key has not been
created or configured.

Focused correspondence/API/UI tests passed (47 tests in five files). The browser
suite passed the existing 75 scenarios; the added explicit-check/denied-refresh
scenario passed separately after correcting its test expectation for development
Strict Mode's repeated availability GET (no duplicate correspondence POST).
Workspace types passed. The lint run found an unavailable lint-rule annotation;
the callback now has explicit dependencies and the corrected lint run passed.
Full Portal tests passed (670 files, 3,836 tests, 11 skipped), as did the isolated
production build. Logs: `correspondence-boundary.log`,
`browser-correspondence.log`, `browser-correspondence-recheck.log`,
`doctor-correspondence.log` (types passed; initial lint annotation failure),
`lint-correspondence.log`, `tests-correspondence.log` and
`build-correspondence.log` in the existing local evidence directory. All six
route bundle budgets passed against that output (`bundle-correspondence.log`);
build-generated tsconfig additions were restored. The paired receiver and live
journey are still missing, so the overall 8/10 acceptance is not claimed.
Architecture reporting is clean. The existing 819-line QuoteDetailView keeps its
bounded expiry fix. The growing command-centre browser suite remains a warning;
the next safe extraction is its shared shell fixture response builder and the
staff correspondence journey, rather than changing unrelated lifecycle tests.

Fourth local batch: Velt receiver implemented in
`%USERPROFILE%/source/worktrees/velt-staff-correspondence`, branch
`codex/staff-project-correspondence`, base `5c53163`. Shared summary and Outlook
service primitives preserve the existing owner paths; staff authentication is
separate. Migration `202609160003` adds a body-free staff request/event record,
atomic nonce claims, one concurrent request, 20/hour aggregate cap, 60-second
lease, ordered source/model checkpoints and final global/provider revocation
checks. No live key, migration, provider call or deployment occurred.

Evidence in Velt `.praxis-evaluation-private/staff/`: workspace lint/types/build
passed; all non-web workspace tests passed. The unrestricted web test run had
one fork process crash; rerunning that suite with four workers passed 144 files
and 992 tests (52 intentionally skipped). The native PostgreSQL suite passed all
11 cases, including simultaneous nonce claims and Outlook stop/resume before
delivery. The final fencing fixture initially omitted its required inbox intent;
the corrected synthetic fixture passed without weakening the production check.
All 44 built-browser scenarios passed. Logs: `workspace-lint.log`,
`workspace-types.log`, `workspace-tests.log`, `web-tests-bounded.log`,
`workspace-build.log`, `postgres-final.log`, `browser-built.log`.

Paired wire proof passed in both repositories: the real Portal signer emitted a
synthetic request and Velt's real validator accepted it and rejected a changed
project. Logs: Portal `.codex-tmp/clarity/paired-wire.log`, Velt
`.praxis-evaluation-private/staff/paired-wire.log`. This proves signed transport
compatibility, not deployed HTTP, provider access or semantic customer accuracy.
The opt-in tests use `STAFF_CORRESPONDENCE_WIRE_FILE` for that synthetic artifact;
no secrets or real customer data enter it. Both receivers remain disabled.

### Final local review and remaining release gate

Returning from a source now hides evidence until staff/project access is checked,
then restores the in-memory summary without another model read. At two minutes
it is explicitly labelled earlier evidence; failed checks and project changes
discard it. Fourteen focused component tests and the affected browser journey
passed (`return-final.log`, `browser-return-final.log`). Browser visibility was
simulated in that automated case; it is not live Outlook acceptance. Waiting-stage
recommendations now refer to the Project Work controls actually present.

Final return-batch workspace types/lint, isolated production build, all six route
bundle budgets and diff-whitespace checks passed. Logs: `types-return-final.log`,
`lint-return-final.log`, `build-return-final.log`, `bundle-return-final.log` in
the existing Portal evidence directory. The build's incidental tsconfig additions
were restored. The browser viewport was reset. Earlier full-suite evidence is
retained; only the affected return behavior and copy changed in this batch.

Continuation audit: the preceding turn was progress (return behavior, affected
tests/build and final local review). Reinspection confirms the orientation/owner
requirement has local evidence: `ProjectWorkSection.test.tsx` asserts primary
owner Jordan, due date and explicit assignee Sam Sales; the browser suite asserts
Unassigned and specialist ownership, stage-specific actions, and a single owner
control in the responsive project masthead. `browser-extended.log` contains the
passing corresponding scenarios. This closes the record's previously unverified
local orientation entry without substituting fixture proof for real staff use.
No new publication or live-access authorization has arrived; the draft-publication
question remains pending. Remaining required work is deployed two-customer/staff
acceptance under the separate release, access and spending boundaries above.

Local understanding is assessed at **8/10**: current work, agreed quote/source,
payment components and labelled email claims are distinguishable, with source
disclosure and explicit next actions. Evidence: 75 representative browser cases,
the additional correspondence case and final return regression; manual desktop
and 390px waiting-stage review. Remaining weakness: existing server-ranked reason
text can be technical, and customer-address association still requires staff
judgment when a customer has several jobs.

Local visual clarity is assessed at **8/10**: desktop grouping and mobile records
retain commercial amounts/actions; correspondence labels and disclosures remain
readable at 390px. Prior keyboard, six-width and recovery checks passed. The long
mobile page and existing dense quote detail remain optional polish. These are
reasoned local UI scores, not user acceptance or proof of live email correctness.

Other relevant dimensions: financial/source correctness and recovery have focused
regression evidence; wider-system fit retains specialist mutations and shared
owner/provider primitives; privacy has staff/project denial, signed request,
replay and stop-fencing tests. Maintainability is limited by the existing large
quote component and browser suite. Performance has build/bundle evidence and
bounded reads. End-to-end security, operating cost, customer correctness and
handover remain **unverified in the deployed environment**, so the whole goal
does not yet satisfy the completion gate.

Release sequence requiring separate authorization:
1. Review the exact two candidate revisions and reconcile current bases with the
   customer-journey work; publish/merge only under explicit release authority.
2. Confirm owner customer-journey prerequisites and reporting migrations are
   deployed and healthy. Install Velt migration `202609160003`, deploy both apps
   with the staff feature disabled, and install a dedicated server-only signing
   key and reviewed destination binding. No key exists in this working lane.
3. Enable the paired staff route for a bounded read-only proof using an ordinary
   staff account, Peter's project and a second customer. Verify identity, matched
   messages, source excerpts, agreement/unknown labels, audit, access loss and
   return behavior. Any model cost needs an agreed limit before that proof.
4. Staff review the source and use existing controls for any chosen changes;
   this proof does not authorize email sends or project-record mutations.
5. Roll back activation by disabling both staff flags; use Connections stop for
   provider access if needed. Retain audit history; no destructive DB rollback.

Local candidates are ready for owner review and remain uncommitted in the two
named isolated branches. Publication as draft PRs is the next proposed step,
pending authorization under the local-only goal boundary. Merge, deployment,
credentials, paid reads and live activation remain separate approval gates.
Blocked audit: the same release-authorization boundary has persisted across three
consecutive goal turns. Local verification is complete; both feature gates still
default off in source. No approval has arrived. The goal is blocked on owner
authorization, not complete; resume with the scoped publication/release decision
and preserve the outstanding real-customer acceptance requirement.

### Resumed release assessment after owner approval

The original shell preview depended on Playwright response interception for
Overview reads; a successful HTTP response was insufficient handoff evidence.
Jordan's screenshot showed the resulting unavailable state. Replaced the view
link with `/qa/project-command-centre-fixture?scenario=accepted-newer-estimate&work=v2-primary&state=ready`
and inspected its rendered work, owner, accepted quote, payment components, notes
and supporting correspondence. This is synthetic read-only UI evidence, not a
live project. Keep the populated preview visible for owner review.

Fresh remote inspection: Sanctuary main is `ecdc9f7` (no intervening changes in
the owned project-page/correspondence paths); Velt main is still `5c53163`.
Velt PR361, **Fix customer journey rejection of linked contacts**, is open with
passing CI. It corrects rejection of canonical contacts with null project IDs;
its description explicitly leaves deployment and live customer/model acceptance
pending. That prerequisite must be integrated and verified before claiming the
staff correspondence feature production-ready. Do not modify the other task's
dirty activation worktree. Owner release permission is no longer the blocker.

Backfill behavior clarified to Jordan: this candidate performs an explicit
per-project customer-address check, up to 25 messages within 180 days. It can find
historical messages within that bound after activation, but does not automatically
populate all projects, retain a complete mailbox history or silently change jobs.
Any bulk backfill is a separate product/coverage/cost decision, not an existing
capability or an implied consequence of deployment.
Velt's
address-only match must be labelled as customer association, not proof that a
message belongs to this project. Do not forward owner sessions or enable a live
staff route until the required server controls are implemented and reviewed.
The historical completed V2 programme below is not completion of this goal.

Status: Active programme tracker
Current stage: Overview V2 composition and portfolio-wide Project Work adoption are deployed and production-verified through postflight `6832a9dd`
Product definition: Complete
Implementation: Historical Stages 1 and 2, the production Project Work foundation, the replay-safe all-project rollout, five journey phases, authoritative Active/Waiting/Closed/Archived portfolio views, one paged Work Queue, one Overview work surface, and complete legacy project-task UI/read/write retirement are present. The current hierarchy refinement keeps server-ranked reasons explicit, commercial presentation read-only, recovery singular, and the 768px recomposition intentional.
Next action: Preserve the verified command-centre boundaries and assess any later lifecycle expansion as a separate product slice.
Next implementation stage: Deposit, Schedule/Running Jobs readiness, normalized activity, and complete exception summaries still require separately reviewed bounded server projections.

## Index

- [Document hierarchy](#document-hierarchy)
- [Stage sequence](#stage-sequence)
- [Stage status](#stage-status)
- [Operating rules](#operating-rules)
- [Stage 1 handoff](#stage-1-handoff)

## Programme purpose

This roadmap tells any future ChatGPT, Codex, or human contributor:

- What controls the programme.
- Which stage is current.
- What has been completed.
- What may be changed now.
- What must remain out of scope.
- What evidence is required before advancing.

Keep this document concise. Current redesign detail belongs in the approved handover in `project-command-centre-architecture.md`; historical V1 detail remains in `project-command-centre-v1.md`.

## Document hierarchy

1. `project-command-centre-vision.md` controls long-term direction and non-negotiable principles.
2. `project-command-centre-architecture.md` section `Approved Overview V2 Implementation Handover (READ FIRST)` controls the current redesign and records its repository ownership, implementation boundaries, tests, and risks.
3. `project-work-items-and-follow-up.md` and `project-work-items-technical-plan.md` control the current Project Work product and technical boundaries.
4. `project-command-centre-v1.md` is the historical V1 baseline and retains only non-conflicting design/commercial truth rules.
5. This roadmap records programme stage and completion evidence.
6. Individual Codex goals control one bounded stage or approved pull request.

When documents conflict:

- Product behavior for the current redesign follows the approved V2 handover and Project Work contract.
- Non-conflicting current-design and commercial precedence follows the V1 specification.
- Repository facts follow the architecture document after Stage 0.
- An implementation goal may not silently alter either.

## Stage sequence

Stages 0-6 below record the historical V1 programme. **Overview V2 composition and portfolio adoption are deployed and production-verified.** The five journey phases group existing stages for presentation and filtering only. Any future readiness or full-lifecycle summary remains deferred and must use bounded server-owned evidence under a separate reviewed contract.

### Product definition

#### Outcome

- Permanent product vision agreed.
- V1 product contract agreed.
- Stage sequence agreed.
- Stage 0 goal prepared.

#### Scope

Product and workflow decisions only.

#### Exclusions

- No code.
- No migration.
- No technical architecture presented as verified repository fact.

#### Status

Complete.

---

### Stage 0: Repository assessment

#### Outcome

- Produce the complete proposed content for `project-command-centre-architecture.md`.
- Verify every relevant repository assumption.
- Produce the final implementation and pull-request sequence.
- Identify required read models, APIs, migrations, RLS, tests, fixtures, and documentation.
- Produce a tight proposed Stage 1 prompt.

#### Scope

Read-only repository investigation.

#### Exclusions

- No application code changes.
- No migration.
- No branch or pull request.
- No Stage 1 implementation.
- No product-rule changes.

#### Completion evidence

- Architecture document is specific enough that Stage 1 does not need to rediscover repository ownership.
- Genuine technical unknowns and business decisions are separated.
- Stage 1 scope and verification are approved.

#### Status

Complete.

---

### Stage 1: Read-only Command Centre shell

#### Outcome

- `Overview` becomes the staff-facing default project experience.
- Project identity, current design, current commercial record, and existing customer context are clear.
- Current-design and commercial fallbacks are trustworthy.
- Existing loading, stale, failure, and unavailable states remain truthful.

#### Scope

Read-only information derived from existing trusted data wherever possible.

#### Exclusions

- No new owner workflow.
- No canonical primary-action implementation.
- No workstream editing.
- No approval system.
- No structured call or message records.
- No later lifecycle functionality.

#### Completion evidence

- Current design and price pass all approved source scenarios.
- Missing quote source never borrows another estimate.
- Existing specialist workflows remain accessible.
- Project performance and bundle gates remain green.

#### Status

Complete in commit `8770198f`, which is present in the current repository history.

---

### Stage 2: Ownership and primary next action

#### Outcome

- One reliable Project Owner from lead through deposit, chosen from Jordan, JP, Joe, or Bruce.
- One primary next action per active project.
- Owner, due state, completion, rescheduling, and reassignment.
- No-owner and no-action dashboard exceptions.
- No duplicate general task system.

#### Scope

Ownership, primary-action selection, controlled actions, audit history, and dashboard exceptions.

#### Exclusions

- No general task manager.
- No subtasks or dependencies.
- No Project Manager or builder ownership.
- No advanced notifications.
- No installation workflow.

#### Completion evidence

- Source tasks are referenced, not copied.
- One action is shown.
- Failure recovery is complete.
- Due dates are timezone-safe.
- Business SLA and severity decisions are recorded in the V1 specification.

#### Status

Repository implementation complete. The product contract, both canonical migrations, selector/domain APIs, project/dashboard UI, automation cutover, compatibility projection, legacy writer retirement, and repository-local gates are complete. Stage completion remains Yellow until both ordered migrations pass an executable PostgreSQL/Supabase smoke and authenticated real-project Playwright passes with provisioned staff credentials plus dedicated safe mutation and conflict projects.

---

### Stage 3: Lead-to-quote workstreams

#### Outcome

Four evidence-derived workstreams:

1. Sales and customer commitment.
2. Site information.
3. Design and estimating.
4. Quote and commercial.

#### Scope

Server-derived state, evidence, actions, address verification, and the smallest explicit site-visit requirement decision if required.

#### Exclusions

- No manually editable workstream health.
- No engineering.
- No consent.
- No procurement.
- No installation readiness.
- No completion or defects.

#### Completion evidence

- Every state is reproducible from canonical evidence.
- Unknown is used when evidence is inadequate.
- Each warning and blocker routes to its owner.
- Business decisions for address verification and site-visit requirements are approved.

#### Status

Not started.

---

### Stage 4: Communication summary and timeline

#### Outcome

- Latest meaningful outbound customer update.
- Latest customer response.
- Structured call and message records.
- Unified meaningful project timeline.
- Failed material communication visibility.

#### Scope

Communication read model, optional structured note metadata, event grouping, and logging controls.

#### Exclusions

- No inbox integration.
- No private-email ingestion.
- No SMS sending.
- No customer portal.
- No AI summaries.

#### Completion evidence

- Automated acknowledgement is distinct from personal contact.
- Historical notes remain valid.
- Timeline is business-readable rather than technical noise.
- Existing note permissions remain intact.

#### Status

Not started.

---

### Stage 5: Blockers, warnings, and approvals

#### Outcome

- Reliable critical exceptions and warnings.
- Version-bound commercial approvals where source data is trustworthy.
- Approval audit and invalidation.
- Dashboard exception integration.

#### Scope

Issue resolver, issue actions, approved commercial controls, permissions, and audit.

#### Exclusions

- No generic approval builder.
- No engineering or consent approvals.
- No scheduling override.
- No construction release.
- No AI risk detection.

#### Completion evidence

- Red, amber, blocker, and approval meanings are deterministic.
- A manual green state is impossible.
- Approval thresholds are approved.
- Material quote or estimate changes invalidate relevant approval.

#### Status

Not started.

---

### Stage 6: Responsive polish and complete QA

#### Outcome

- Production-ready desktop, tablet, and mobile Overview.
- Accessibility and recovery behaviour.
- Complete representative fixtures.
- Performance, bundle, and workflow verification.
- Staff pilot and rollout readiness.

#### Scope

Cross-stage quality, documentation, pilot preparation, and final acceptance evidence.

#### Exclusions

- No new business workflow.
- No later-lifecycle feature.
- No general design-system rewrite.
- No unrelated portal redesign.

#### Completion evidence

- Five staff complete the unfamiliar-project test.
- All V1 acceptance criteria pass or have an approved exception.
- Existing portal quality gates remain green.
- Documentation matches implementation.
- Pilot, rollback, and measurement process are documented.

#### Status

Not started.

## Stage status

| Stage | Status | Current PR | Completion evidence |
| --- | --- | --- | --- |
| Product definition | Complete | - | Vision, V1 specification, roadmap, and Stage 0 prompt approved |
| Stage 0: Repository assessment | Complete | - | Repository-grounded architecture, ownership, boundary, risk, and Stage 1 sequence recorded against baseline `ea1641c6` |
| Stage 1: Read-only shell | Complete in `8770198f` | Present in current repository history | Strict read model/API/query, Overview UI, legacy retirement, deterministic fixtures, focused/project/browser/performance tests, typecheck, lint, isolated production build, and unchanged bundle-budget assertions |
| Stage 2: Ownership and primary action | Repository complete; environment gates pending | Present in current repository history | Canonical ownership/actions/audit migrations, selector, APIs, Overview/header/dashboard UI, automation persistence extraction, and legacy writer retirement implemented. Local evidence: 335/335 project tests, 18/18 fixture Playwright checks, full typecheck/lint, isolated 66-page production build, unchanged six-route bundle budgets, architecture/docs/dead-code guards. Executable smoke for both ordered migrations and authenticated real-project Playwright remain required. |
| Stage 3: Lead-to-quote workstreams | Historical/deferred | - | Superseded as the next step by the approved Overview V2 handover |
| Stage 4: Communication and timeline | Not started | - | - |
| Stage 5: Exceptions and approvals | Not started | - | - |
| Stage 6: Responsive QA and rollout | Not started | - | - |
| Overview V2 redesign | Complete and deployed; narrow handoff exception later closed | `20a8adee`, production release `c9e73651` | Five required top-level owners plus extracted V2/legacy controls, command orchestration, conflict/history, visibility-policy, and shared-cache owners; one mixed-model Project Work surface; filtered read-only legacy rows; focused Project Work and project coverage, 70 browser checks, responsive/accessibility evidence, full build/static gates, unchanged Project Detail budget, manual authenticated inspection, and the automated authenticated read-only staging command passed. The pre-existing Contacts/Calculator overruns were accepted only for the handoff; their ceilings remained unchanged, and later isolated route optimization brought both within budget. Production cutover and snapshot-cache verification then passed without migrating pre-cutover projects. |

## Operating rules

- One stage per Codex goal unless the architecture document explicitly recommends smaller pull requests within that stage.
- Use one reviewable pull request per implementation unit where practical.
- Do not pull later-stage work forward without explicit approval.
- Product rules may change only through an approved update to the current V2 handover or its named successor.
- Repository architecture findings belong in `project-command-centre-architecture.md`.
- Every completed stage updates this roadmap with status, PR, and completion evidence.
- Every Codex prompt states:
  - Current stage.
  - Previous completed stage.
  - Exact outcome.
  - Scope.
  - Exclusions.
  - Verification.
  - Completion criteria.
- Schema changes require:
  - Ordered forward migration.
  - RLS and grants decision.
  - API ownership.
  - Backfill or compatibility decision.
  - Rollback posture.
  - Focused tests.
  - Documentation update.
- No implementation goal may redefine the product.
- No implementation goal may make workstream state manually editable.
- No implementation goal may duplicate canonical design, quote, price, communication, or issue state.
- Do not weaken access, loading, local-first, performance, bundle, or historical-record guarantees to make a stage easier.
- Historical Stage 0 could split an implementation stage but could not broaden V1. Current implementation may not broaden the approved V2 handover.

## Stage 1 handoff

```text
Historical stage handoff: Stage 1 - Read-only Command Centre shell
Pull request at the time: None recorded; commit `8770198f` is now present in current repository history
Repository baseline: 8770198f
Product behaviour delivered at Stage 1: Overview default label; strict current quote/estimate, source, price, delivery, and costing-freshness read model; existing customer context, notes, tasks, Details, and specialist workflows retained. Later project-shell work consolidated Details into Overview, replaced the legacy project estimate surface with Calculator, grouped Quotes/Invoices in Commercial, and retired the Emails UI.
Verification completed: selector/loader/route/component/access tests; 322 project tests; 15 browser checks passed with 1 conditional workbench skip; 9 fixture performance checks; repository typecheck and lint; isolated production build; all unchanged bundle budgets; docs, architecture, file, ownership, and strict dead-code reports
Known limitations: authenticated smoke and production performance could not be rerun locally because PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD were unavailable; the canonical build preflight was correctly blocked by the user's pre-existing port-3001 dev server, so the same production build and budget assertions ran against an isolated Next output directory
Architecture document updates: Stage 0 repository contract completed and Stage 1 implementation/evidence recorded
Roadmap updates at the time: Stage 0 and Stage 1 complete; Stage 2 baseline begins at `8770198f`
Historical next stage at that checkpoint: Stage 3. Current state: the approved Overview V2 redesign is complete in `20a8adee`, deployed through the controlled Project Work cutover, and its narrow historical bundle exception is closed by later optimization without raising ceilings. No later lifecycle summary is approved merely because its eventual position is shown in the handover.
```

## Stage handoff template

At the end of every stage, record:

```text
Stage completed:
Pull request:
Repository head:
Product behaviour delivered:
Verification completed:
Known limitations:
Architecture document updates:
Roadmap updates:
Next approved stage:
```
