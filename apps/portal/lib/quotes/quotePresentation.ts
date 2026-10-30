import type { StudioQuoteView } from "@sp/quote-format";
export const SANCTUARY_QUOTE_PRESENTATION_VERSION =
  "sanctuary-quote.v3" as const;
/** Presentation is immutable snapshot data, not a global cache revision. */
export function quotePresentationVersion(
  view: StudioQuoteView | undefined,
): "legacy" | typeof SANCTUARY_QUOTE_PRESENTATION_VERSION {
  if (!view || !Object.hasOwn(view, "quotePresentationVersion"))
    return "legacy";
  if (
    view.schemaVersion !== "studio_quote_snapshot.v2" ||
    view.documentMode !== "separate_v1" ||
    view.quotePresentationVersion !== SANCTUARY_QUOTE_PRESENTATION_VERSION
  )
    throw Error("The frozen quote presentation is unavailable.");
  return view.quotePresentationVersion;
}
