# Portal Action And Recovery Audit

Status: Current evidence tracker.

Last updated: 2026-08-13.

Purpose: keep every operational staff and admin action truthful under slow responses, repeated clicks, ambiguous network outcomes, failed reconciliation, modal close attempts, and route changes.

## Action Contract

Every portal command follows these rules:

1. Acquire a synchronous ref-backed lock before the first `await`; render the matching pending state and disable every control that can change the command payload.
2. Give create, send, append, and other non-idempotent commands a stable client intent or caller-owned record ID. Reuse it for an ambiguous retry and rotate it only after confirmed success or an explicit new command.
3. Treat the command response as the first authoritative result. Apply it immediately when practical.
4. Treat a follow-up list/query refresh as reconciliation, not as part of command success. If reconciliation fails after a committed command, say that the action completed and offer Refresh; never invite staff to repeat the write.
5. Roll back only the failed entity or field for optimistic reversible writes. Keep later independent edits intact.
6. Ask for destructive confirmation before mutating local state. Keep dialogs open and payloads fixed while their request is pending.
7. Block conflicting selection, modal-close, Back, and navigation actions while an exact editor save is in flight. Unrelated page navigation remains available where it cannot lose or duplicate work.
8. Make recovery explicit: safe retry with the same identity, retained local-first draft, scoped rollback, or a visible reconciliation lock. Never claim success before the command confirms.

## Page-By-Page Checklist

| Surface | Actions reviewed | Duplicate and pending protection | Failure and recovery result |
| --- | --- | --- | --- |
| Dashboard | Create and complete personal task | Stable caller task ID; create and per-task synchronous locks | Committed row is applied directly; failed requests retain actionable feedback |
| Projects index and create | Create, inline edits, stage/state changes, archive, restore, delete | Create lock; project create already has stable command identity; per-project mutation locks | Reversible changes use entity/field-scoped rollback; hard delete waits for confirmation; cache invalidation failure does not relabel a committed delete |
| Project Overview and Project Work | Project/contact detail saves, notes, owner changes, Project Work commands and confirmations | Existing local-first queue, stable command receipts and row versions; synchronous locks now also cover queue commands, confirmation correction/reconciliation and bulk stale-enquiry closure | Desired drafts survive transient/offline failure; terminal failure restores confirmed values without discarding the rejected draft; committed bulk-close rows are removed from both cached queue and review before reconciliation |
| Estimates and Calculator | Create, duplicate, rename, remove, Save, actual-cost review | Exact save/rename locks; save dialogs and design selection are fixed while saving; calculator Back is disabled during save | Local-first estimate queue remains authoritative; retries preserve the desired draft and lock/conflict states remain visible |
| Design Workbench | Save estimate-backed design | Synchronous save lock before the async boundary | Existing error state remains visible and another save cannot enter in the same render frame |
| Quotes | Create, update, prepare/send, accept, decline, revise, refresh, supersede, delete, job-pack generation | Stable create/revision intents; exact lifecycle/delete/supersede/send locks; dialogs freeze and cannot close during commands | Returned versions are applied immediately; a failed reconciliation reports completion plus refresh need instead of reporting command failure |
| Invoices and payments | Create/split invoice, send, mark paid, record/adjust/reverse/allocate payment, void | Stable invoice/payment intents; one financial-command lock; command controls and dialogs lock together | Returned invoice/payment data is cached immediately; failed reconciliation enters a visible recovery lock and blocks another financial command until Refresh |
| Job packs, Design List and Running Jobs | Generate, edit spreadsheet fields, retry conflict | Existing generation reuse plus shared ordered optimistic spreadsheet queue | Row/cell-scoped rollback and conflict recovery preserve unrelated edits; no new action owner was required |
| Schedule Board and Gantt | Assign, move, reorder, resize, unschedule, downtime and confirmation actions | Existing resource-scoped command serialization, command records and confirmation ownership | Accepted placement is not rewound by late reads; definitive failure rolls back only affected resources; ambiguous recovery blocks only its resource |
| Site Visits compatibility view | Book, save, confirm, complete, reschedule, unschedule, assign and remove orphans | Modal-wide synchronous lock; fields, close and conflicting controls are disabled; exact orphan/assignment locks | A committed command remains successful if refresh fails; the retained view reports stale data and offers recovery |
| Contacts | Create, edit and CSV import | Stable caller contact IDs; create/import locks; completed CSV rows are checkpointed | Import retry resumes only unfinished rows; refresh failure after import is described as reconciliation failure; contact detail retains local-first recovery |
| Email Previews | Send preview variants | One stable intent per selected layout and a delivery lock | Failed/ambiguous retries reuse the same provider idempotency identity; no duplicate preview email is intentionally created |
| Design Booklets | Autosave, asset upload, revision, PDF | Existing serialized autosave/upload and revision owners | Visible save/export failure retains the working state; no action-owner change was required |
| Admin Imports | CSV import/upsert | Same-tick import lock and whole-form disable | Errors identify partial/upsert-safe retry rather than claiming an all-or-nothing result |
| Admin Access | User access, create/edit/enable crews, reorder | User, create, per-crew and reorder locks; stable caller crew ID | Exact control reports failure and re-enables safely; replayed crew create resolves to the committed row |
| Admin Costing | Create/open draft, save, validate/publish | Stable caller version ID and page-wide command lock | Save recognizes an identical uncertain-response replay; publish recognizes the already-published hash; refresh failures do not erase confirmed draft/publish success |
| User menu themes | Apply theme; create, update and delete preset | Theme/preset lock; stable caller preset ID; destructive action stays locked | Create replays return the committed preset; delete is idempotent; durable preset success is distinguished from a later theme-application failure |
| Auth, read-only admin cost pages, UI foundation, diagnostics and redirect aliases | Navigation/read-only behavior only | No domain write action exists | Covered by route/access smoke rather than mutation recovery |

## Data And Retry Boundaries

- `contacts.id`, `schedule_crews.id`, `costing_configuration_versions.id`, theme preset IDs, dashboard task IDs, and commercial invoice/payment client-intent columns are caller-owned command identities where the action creates durable data.
- `commercial_create_admin_invoice_idempotent(...)` and the intent-aware payment RPC serialize and replay the financial commands without creating a second row or ledger entry.
- Email preview delivery passes the browser-owned intent to the shared email-provider idempotency owner.
- Existing local-first, Schedule V2, spreadsheet, commercial-email-intent, and Project Work command systems remain their domain owners; the audit does not introduce a second mutation queue.

## Workbench Gate Record

The action audit touches the design-workbench estimate client only to prevent two saves entering before React rerenders. Legacy cull rows: N/A. It neither removes nor builds on a legacy geometry, drawing, or costing-input path. Phase 2 dependencies: none. Consolidated functions/types: none, so there are no parameter or field differences to reconcile.

## Verification

Focused automated coverage owns:

- commercial quote, invoice, payment, email-preview and idempotency migration behavior;
- calculator save and actual-cost behavior;
- Projects, Contacts and resumable CSV import actions;
- Schedule/Site Visit actions and the existing Schedule command-recovery matrix;
- admin Access, Imports, Costing and theme behavior;
- architecture, browser-Supabase, service-role, changed-file and documentation guards.

Authenticated browser smoke must exercise the catalogued staff routes without creating real email or financial side effects. Destructive, send, payment and production-write scenarios remain focused mocked/fixture tests unless an explicitly approved disposable environment is used.

## 2026-08-13 Evidence

- `npm run typecheck`: passed.
- `npm run lint`: passed, including docs, package-boundary, cache, brand and mojibake guards.
- Full portal suite: passed on the final tree with `npx vitest run apps/portal --maxWorkers=2`. An earlier broad invocation used the package script incorrectly (so it selected the whole portal suite) and exhausted worker processes; the exact three newly added Project Work files then passed 7/7 with one worker before the clean constrained full rerun.
- Focused action matrix: 23 files / 106 tests passed; the final costing/theme/idempotency rerun passed 4 files / 26 tests. A final Project Work reconciliation pass added seven passing tests for same-tick queue, correction-review and bulk-close command protection.
- Marketing adapter coverage: the changed autoresponder-preview test and the isolated token-reference test passed 2 files / 11 tests. The first broad marketing run hit a pre-existing nondeterministic token-tampering mutation plus a worker exit; both the changed adapter and that exact failing test passed immediately in isolation.
- `npm run architecture:changed`: clean. Dead-code, root-compatibility, browser-Supabase and service-role reports found no new boundary growth. Existing approved browser adapters and commercial server-only service-role owners remain unchanged.
- `npm run audit:security`: still reports the repository's existing `nanoid` high advisory and `postcss` moderate advisory; no dependency change is included here.
- Production portal build: passed from a separate `.next-action-audit-build` output so the user-owned portal dev process could keep its normal `.next` directory. The isolated generated output was removed after verification.
- Authenticated local browser smoke passed Dashboard, Projects, Contacts, Schedule, email previews, design booklets, admin imports/access/costing, live project Quotes/Invoices, and the final 804-project Work Queue render. No build overlay appeared. The smoke was read-only.
