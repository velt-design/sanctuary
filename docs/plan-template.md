# Plan Template

Use this structure when delivering a plan for non-trivial work — multi-PR sequences, contract changes, refactors with >100 LOC ripple, or any change touching a load-bearing system. **The goal is to give the reader enough information to make a go/no-go decision without having to spelunk for implications.**

## Read First

- Use this template for planning docs, not current-state owner docs.
- Keep plans decision-complete and compact enough for another agent to execute.
- Prefer updating existing current-state docs over creating a new plan when no future sequence is needed.

## Scaling guidance

Not every plan needs every section. Adaptive sizing:

| Plan size | Required sections | Often skip |
|---|---|---|
| 1-PR fix, <100 LOC | Goal, Architectural fit, CTA | Per-PR file map, sequencing diagram, estimates table |
| Multi-PR, contract change | All sections | — |
| Bug fix with broad ripple | Goal, Architectural fit, File map, Risk, Acceptance, CTA | Sequencing diagram, estimates |

**Three sections are required regardless of size: Goal, Architectural fit, CTA.** The first frames the work, the second guards against drift, the third lets the user act.

Don't pad small plans into big ones. A 1-PR fix written in the full template shape signals you didn't think about which sections were load-bearing.

---

## Section guide

### 1. Goal

**Always required.** One sentence. State the constraint and the outcome.

> *"Eliminate the duplicate `house-roof-hip-1` key error in multi-house scenes by making every house-derived object id globally unique."*

Not a paragraph. If you can't say it in one sentence, the plan probably isn't ready.

---

### 2. Architectural fit

**Always required.** Four sub-questions. Each 1-3 sentences. The structure is designed to resist rubber-stamping — generic answers will look generic, and that's the point.

#### Which north-star invariant or principle does this serve?

Name the specific thing. Not "improves architecture" — quote the invariant from `docs/design-workbench-architecture.md` or the relevant doc. If you can't find a principle that applies, that's a signal the work might not be the right move.

#### What alternatives were considered, and why rejected?

2-3 alternatives, each with the reason it lost. Often the most informative part of the plan — the reader learns the shape of the decision, not just the chosen path. If you only considered one approach, say so explicitly ("only one viable approach because X").

#### What does this consciously NOT try to do?

Intentional scope limits. **Different from "future work"** — these are *decisions*, not just things deferred. Captures the things a reviewer might reasonably expect but that you chose to leave alone, with the reason.

#### Net tech debt: pay down or add?

One-line judgment. Forces honesty about whether this is cleanup or expansion. Acceptable answers include "net pay-down", "net add but justified by X", "neutral — refactor without scope change".

---

### 3. The new model (when applicable)

**Skip if there's no contract change.** When there IS a contract change (type, function signature, API shape), show the concrete shape — code block, table, or diagram. The reader needs to see what's actually changing, not be told about it abstractly.

```ts
// Example: adding houseId to HouseModel3D
export type HouseModel3D = {
  houseId: string;  // ← NEW, required
  footprint: Polygon3;
  // ...rest unchanged
};
```

---

### 4. PR sequence (multi-PR plans only)

**Skip for single-PR work.** One heading per PR. Each PR section should answer: what does this PR accomplish, what does it touch, what does the verification look like.

```markdown
## PR-X1 — Atomic sweep (the real work)
[One PR. Contract change + every prefix + every consumer + every test. ~30 files, ~400 LOC.]

### Source changes
[Per-PR file map table — see section 5]

### Test plan inside PR-X1
1. Typecheck clean
2. Targeted test suites green
3. Marketing email path (HARD GATE) 6/6
4. Manual verification: <specific UI check>
```

---

### 5. Per-PR file map

**Highly recommended for any non-trivial plan.** Table with three columns: **file · change · LOC**. The file column is load-bearing — readers want to know "where will I look".

| File | Change | LOC |
|---|---|---|
| [contracts.ts](../packages/geometry/src/contracts.ts) | Add `houseId: string` to `HouseModel3D` | +2 |
| [viewer.ts](../packages/geometry/src/viewer.ts) | Prefix every output id, set `sourceId` to unprefixed form | +40 |

Use markdown file links (relative paths). LOC estimates are educated guesses — they bound the change for the reader.

---

### 6. Risk + mitigation

**Always for non-trivial work.** Table with three columns: **risk · likelihood · mitigation**. Likelihood scale: Low / Med / High / Very Low.

| Risk | Likelihood | Mitigation |
|---|---|---|
| Subtle consumer matches `id` directly (not `sourceId`) | Med | `sourceId` bridging covers the documented hover path. Test sweep + manual workbench refresh catches the rest. |

Don't list risks you can't articulate a real mitigation for. If a risk is unmitigated, say so — that's information.

---

### 7. Acceptance criteria

**Always.** Explicit, tied to existing gates where they apply:

- Typecheck clean
- Test suites that must stay green (list them)
- HARD GATE: marketing email path (if touching `apps/portal/lib/drawings/`, `apps/portal/components/drawings/`, `packages/geometry/`, or `packages/costing/`)
- Manual verification steps (if UI)

Not just "tests pass" — name the *specific* tests and the *specific* gates.

---

### 8. Estimates

**For multi-PR plans.** Table with **PR · LOC · risk · time**. Don't promise hours that you haven't earned the right to estimate. Ranges are fine.

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-Geo1 (atomic sweep) | ~400 | medium | 4-6 hours of careful work |
| PR-Geo2 (lock-in) | ~50 | low | 30 min |

---

### 9. Sequencing diagram

**When there are real dependencies.** ASCII diagram. Skip for independent or trivially-ordered work.

```
PR-Geo1 ──→ PR-Geo2 ──→ resume CAD UI at PR-W3c
```

---

### 10. What I'd push back on (when applicable)

**Optional but valuable when relevant.** This is where Claude voices opinion about the *original ask* or the *recon's framing* — distinct from "alternatives considered" (which is about chosen approach).

> *"The recon's skeleton suggested 5 steps but didn't sequence them into PRs. The aggressive read: it's all one PR (the type change forces atomicity)."*

If you wouldn't push back on anything, omit the section. Don't pad with "the plan looks good".

---

### 11. CTA

**Always.** One actionable next step. End the plan with a question or clear option set.

> *"Ready to execute? Say go and I'll start PR-Geo1 immediately. Or want me to save the plan to `docs/geometry-house-id-refactor.md` first?"*

Not multiple CTAs. Pick the one that matters most.

---

## Anti-patterns

Things that make plans worse, not better:

- **Generic architectural fit answers** ("this improves maintainability"). Force yourself to name the specific invariant.
- **Padding a 1-PR plan into the full template shape** to look thorough. Adaptive sizing exists for a reason.
- **Listing every possible risk** instead of the ones with real mitigations. Noise drowns the signal.
- **CTAs that are actually multiple options** ("we could do A or B or C, what do you think?"). Pick one. Let the user redirect.
- **Reading the plan as a "decided" doc.** A plan is a proposal until the user says go. Phrasing should reflect that.

## Reference example

The geometry house-id refactor plan from the 2026-05-25 chat session demonstrates this structure on a real problem (file paths, real LOC estimates, real risks). If a future chat asks "what does a real plan in this shape look like?", reference that session's PR-Geo1+Geo2 plan.
