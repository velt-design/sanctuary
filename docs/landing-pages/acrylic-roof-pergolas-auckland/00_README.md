# Sanctuary Acrylic Landing Page Handoff

## Purpose

This package is the implementation handoff for a new Sanctuary Pergolas marketing landing page targeting:

**acrylic roof pergolas Auckland**

Target route:

`/acrylic-roof-pergolas-auckland`

The page should convert qualified Auckland homeowners into initial estimate enquiries while helping them understand whether acrylic roofing, and which acrylic tint, may suit their site.

## File order

Use the files in this order:

1. `01_IMPLEMENTATION_BRIEF.md`
2. `02_PAGE_COPY.md`
3. `03_CONTENT_GOVERNANCE.md`
4. `04_ACCEPTANCE_CRITERIA.md`
5. `05_CODEX_TASK_PROMPT.md`
6. `06_CONTEXT_PACK_COPY_VARIANT.md`

## Source-of-truth hierarchy

When instructions conflict, use this order:

1. `03_CONTENT_GOVERNANCE.md`
2. `02_PAGE_COPY.md`
3. `01_IMPLEMENTATION_BRIEF.md`
4. Existing Sanctuary marketing-site patterns
5. Codex judgement

Do not use Codex judgement to invent technical, commercial, regulatory or project facts.

## Intended workflow

1. Add this folder to the Sanctuary repository under:

   `docs/landing-pages/acrylic-roof-pergolas-auckland/`

2. Open Codex from the repository root.

3. Give Codex the contents of `05_CODEX_TASK_PROMPT.md`, or point it directly to that file.

4. Allow Codex to inspect the current marketing application before implementing.

5. Review the rendered page, unresolved claims and project selections before publishing.

## Important implementation principle

This page should establish a reusable standard for future Sanctuary search landing pages, but the current task is to implement only this page.

Codex may create reusable components when they are clearly useful and fit the existing marketing architecture. It must not build a speculative landing-page framework, redesign unrelated pages or refactor the wider site without a direct need.

## Publication status

The page copy is ready for implementation.

The following still require Sanctuary confirmation before publication where they are introduced:

- Acrylic manufacturer, product and thickness
- Exact technical performance
- Warranty wording
- Public pricing
- Project facts not already verified in the repository
- Current lead times
- Current geographic service limits
- Final consent and engineering wording
