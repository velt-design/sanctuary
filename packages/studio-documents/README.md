# Frozen Studio documents

`./contract` is the versioned drawing input and page inventory. `./render` is
Node-only PDF/raster rendering for the durable document worker. The Portal freezes
its actual resolved scene; the renderer cannot read or reprice live projects.

`contract.ts` also owns the optional immutable layout selector. No selector uses
the original `render.ts` layout; `studio-booklet-layout.v2` uses
`refinedRender.ts`. Both retain the `studio-booklet.v1` job/renderer contract.
Never choose a style from a live flag when resuming frozen page checkpoints.
The archive preserves the selector and validates the complete decoded source.

The refined renderer composes focused cover, sidebar/profile, Plan and technical
isometric presentation helpers. These consume existing canonical assembly and
projection owners; they do not solve geometry or infer survey/engineering facts.
`facts.ts` owns the distinction between general eave levels and explicitly named
horizontal main-bearing levels. Complete exceptional selections use the same
schedule owner as the original layout. Fonts remain Node-only via `assets.ts`.

Inter assets and the vendored fontkit build are exact copies of the repository's
existing approved quote assets. They are packaged here so the worker has no
runtime dependency on another application checkout or an external filesystem.
The original quote asset path remains unchanged for historical PDF compatibility.
Keep updates to these packaged copies explicit and hash-verified against the
canonical repository font assets. No new registry dependency is needed for fontkit.
