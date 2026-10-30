import "server-only";
import { STUDIO_TRAVEL_POLICY } from "@sp/costing";
/** Route metrics exist only for this calculation. Never persist or log this response. */
export function googleSiteTravelProvider(
  fetcher: typeof fetch = fetch,
  key = (
    process.env.GOOGLE_ROUTES_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY
  )?.trim(),
) {
  return async (placeId: string, signal: AbortSignal) => {
    if (!key)
      throw Error(
        "Travel calculation is not configured on this local preview. Retry later or enter a manual allowance.",
      );
    try {
      signal.throwIfAborted();
      const base = { address: STUDIO_TRAVEL_POLICY.base };
      const response = await fetcher(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "routes.legs.duration,routes.legs.distanceMeters",
          },
          body: JSON.stringify({
            origin: base,
            destination: base,
            intermediates: [{ placeId }],
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
            computeAlternativeRoutes: false,
            languageCode: "en-NZ",
            units: "METRIC",
          }),
        },
      );
      if (!response.ok)
        throw Error(
          "The driving route is unavailable. Retry travel calculation.",
        );
      const raw = await response.text();
      if (raw.length > 32768)
        throw Error("The driving route could not be verified.");
      const result = JSON.parse(raw),
        legs = result?.routes?.[0]?.legs;
      if (
        !Array.isArray(result?.routes) ||
        result.routes.length !== 1 ||
        !Array.isArray(legs) ||
        legs.length !== 2
      )
        throw Error(
          "A complete outward and return driving route was not found.",
        );
      const durations = legs.map((leg: Record<string, unknown>) =>
        typeof leg.duration === "string" &&
        /^\d+(?:\.\d+)?s$/.test(leg.duration)
          ? Number(leg.duration.slice(0, -1))
          : NaN,
      );
      if (durations.some((value) => !Number.isFinite(value) || value < 0))
        throw Error(
          "A complete outward and return driving route was not found.",
        );
      return { outboundSeconds: durations[0], returnSeconds: durations[1] };
    } catch {
      if (signal.aborted) throw signal.reason;
      throw Error(
        "The driving route is unavailable. Retry travel calculation.",
      );
    }
  };
}
