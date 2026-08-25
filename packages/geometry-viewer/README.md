# Geometry Viewer

`@sp/geometry-viewer` owns app-independent, read-only presentation primitives
for solved `@sp/geometry` output.

Public boundaries:

- `@sp/geometry-viewer` — camera, bounds and scene renderability primitives.
- `@sp/geometry-viewer/svg` — server-safe deterministic top-projection SVG.
- `@sp/geometry-viewer/react` — reserved for the later client-only renderer
  extraction; it is intentionally not exported until that slice lands.

The package does not solve geometry, persist state, price products, or import
portal/marketing code. Portal measurements, section tools, diagnostics,
selection semantics and telemetry remain portal-owned.
