# Drawings Library

Shared drawing-domain code for the portal workbench lives here. UI components belong in `apps/portal/components/drawings`.

## Boundaries

- `state`: workbench store, object-first models, UI state, inspector/status models, and object-owned diagnostics.
- `geometry`: builders and adapters between portal drawing drafts and `@sp/geometry`.
- `interactions`: shared direct-manipulation engine plus object-family adapters.
- `assembly`: semantic assembly builders and geometry contracts.
- `views`: plan/section/elevation view-model builders.
- `annotations`: annotation policy and placement helpers.
- `details`: generated detail-family foundations.

## Rules

- Keep object-first project/drawing state canonical.
- Keep diagnostic/reference fallbacks explicit and named as diagnostics, not as committed geometry.
- Adapt package output into bundled solved workbench artifacts; do not make individual views rebuild their own geometry truth.
- Geometry solving belongs in `packages/geometry`; this library adapts inputs and output for portal workbench use.
- Persistence is estimate-draft/local-first aware, but server writes should remain in app/API layers.
- Add focused tests for every model, adapter, or object-owned diagnostic boundary change.

## Related Docs

- `docs/design-workbench-architecture.md`
- `apps/portal/components/drawings/README.md`
