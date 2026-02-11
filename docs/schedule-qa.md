# Schedule — Manual QA Checklist

## Schedule V2 (Board + Gantt)
1. Assign job to crew: start is a working day; planned baseline set.
2. Reorder two jobs: downstream dates ripple.
3. Insert downtime (weather) for 2 days: downstream shifts by 2 working days.
4. Drag a job bar to a holiday/weekend: snaps to next working day, becomes pinned.
5. Create pinned collision: conflict appears (Gantt + Board).
6. Inside commit horizon, attempt reorder: confirmation modal appears with preview.
7. Mark job in progress, set days remaining: downstream shifts.
8. Mark done early: prompt appears; choose pull forward; verify shifts + commit horizon prompt if needed.
9. Choose keep schedule: buffer downtime inserted; verify downstream unchanged.

## Schedule V2 — Automated Tests (Minimum)
1. Calendar math tests: `lib/scheduling/workingDays.test.ts` and `apps/portal/lib/scheduling/workingDays.test.ts`
2. Recompute tests: `lib/scheduling/recompute.test.ts` and `apps/portal/lib/scheduling/recompute.test.ts`
3. Suggested command:
```bash
npx vitest run lib/scheduling/workingDays.test.ts lib/scheduling/recompute.test.ts apps/portal/lib/scheduling/workingDays.test.ts apps/portal/lib/scheduling/recompute.test.ts
```

## Board (Crew Columns)
1. Open ` /staff/schedule ` and stay on **Board**.
2. Confirm there are **5 crew lanes**: Jayden, David, Alistair, Eder, Jesse.
2. Drag a job from **Unscheduled** → any crew column.
3. Reorder jobs within the same crew (verify insertion indicator).
4. Move a job from one crew column → another.
5. Unschedule a job via the kebab menu (it returns to **Unscheduled**).
6. Refresh the page: assignments and order persist.
7. Confirm crew columns stay fixed-width and horizontally scroll when many crews exist.

## Gantt
1. Toggle to **Gantt**.
2. Confirm weeks are **Monday-aligned** in the header (“Wk of …” should be Mondays).
3. Confirm weekend shading aligns to Saturday/Sunday.
4. Confirm each crew group row has one row per scheduled project, with a single bar aligned to the correct dates.
5. Click a project row or bar: it opens the estimate viewer.
6. Toggle crew collapse on/off: project rows and bars hide/show.
7. Change range (4/8/12 weeks): bars remain correctly positioned and the left table remains visible while scrolling horizontally.
