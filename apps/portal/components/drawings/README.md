# Drawing Components

UI components for the portal drawing workbench live here. Domain state, geometry adaptation, and view-model building belong in `apps/portal/lib/drawings`.

## Boundaries

- `workbench`: top-level workbench shell, viewport mode switch, and high-level workbench composition.
- `viewports`: Plan, Sheet View, 3D viewport, and viewport interaction presentation.
- `rail`: `ObjectWorkbenchRail`, inspectors, and object editing controls.
- `sheets`: sheet composition UI such as `SheetComposer`.
- `renderers`: reusable drawing renderers when extracted from viewports.

## Rules

- Keep object-first UI wired through the workbench store and derived models.
- Consume bundled solved geometry from the workbench shell; viewport components should present artifact views, not assemble independent geometry state.
- Keep calculator/estimate UI such as `ConfiguratorRail` under estimates or calculator ownership, not drawing workbench ownership.
- Do not make drawing components own costing, Supabase persistence, or package geometry solving.
- Add component tests next to the component when behavior is non-trivial.

## Related Docs

- `docs/design-workbench-architecture.md`
- `apps/portal/lib/drawings/README.md`
