# Geometry Viewer

`@sp/geometry-viewer` owns app-independent, read-only presentation primitives
for solved `@sp/geometry` output.

Public boundaries:

- `@sp/geometry-viewer` — camera, bounds and scene renderability primitives.
- `@sp/geometry-viewer/svg` — server-safe deterministic top-projection SVG.
- `@sp/geometry-viewer/three` — app-independent buffer-geometry, line and
  deck-presentation builders.
- `@sp/geometry-viewer/react` — client-only scene-object dispatch and read-only
  React Three Fiber renderers.

The package does not solve geometry, persist state, price products, or import
portal/marketing code. Portal measurements, section tools, diagnostics,
selection semantics, labels, telemetry and workbench orchestration remain
portal-owned.
