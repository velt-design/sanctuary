# Costing geometry semantics

## Roof Length vs Roof Span

- **Roof Length**: dimension **parallel to the ridge / gutter**.
- **Roof Span (Eave‑to‑Eave)**: total width **across the roof**.
  - **Pitched**: span is the single sloped width (house → gutter).
  - **Gable**: span is the full eave‑to‑eave width (both sides combined).

## Per‑plane (gable) drivers

For **gable** roofs the engine models the roof as **two planes sharing a ridge beam**.

- `roof_plane_count = 2`
- `roof_plane_span_m = roof_span_m / 2`
- `roof_plane_sloped_downslope_m = roof_plane_span_m / cos(pitch)`

## Acrylic sheets: count from total area (avoid double rounding)

When acrylic is in **sheet mode**, sheet quantity is computed from **total acrylic area** (both planes combined), then rounded once:

- `sheet_count = ceil(acrylic_area_total_m2 / sheet_area_m2)`

This prevents gable roofs (e.g. **6×3 gable**) from incorrectly doubling sheets via per‑plane rounding.

