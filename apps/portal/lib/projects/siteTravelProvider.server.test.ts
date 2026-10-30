import { expect, it, vi } from "vitest";
import { googleSiteTravelProvider } from "./siteTravelProvider.server";
import { travelDrivingCostPerRoundTripCents } from "@sp/costing";
it("accepts a complete explicit zero-second round trip without treating a missing route as zero", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        routes: [{ legs: [{ duration: "0s" }, { duration: "0s" }] }],
      }),
    );
  const route = await googleSiteTravelProvider(fetcher, "fixture")(
    "fixture_place",
    new AbortController().signal,
  );
  expect(route).toEqual({ outboundSeconds: 0, returnSeconds: 0 });
  expect(
    travelDrivingCostPerRoundTripCents(
      route.outboundSeconds,
      route.returnSeconds,
    ),
  ).toBe(0);
});
it("requests exactly two actual DRIVE legs in one round trip without polyline or response persistence", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        routes: [{ legs: [{ duration: "6300s" }, { duration: "7200.5s" }] }],
      }),
    ),
  );
  expect(
    await googleSiteTravelProvider(fetcher, "fixture-key")(
      "fixture_place",
      new AbortController().signal,
    ),
  ).toEqual({ outboundSeconds: 6300, returnSeconds: 7200.5 });
  expect(fetcher).toHaveBeenCalledOnce();
  const init = fetcher.mock.calls[0][1],
    body = JSON.parse(init.body);
  expect(body.origin).toEqual(body.destination);
  expect(body.intermediates).toEqual([{ placeId: "fixture_place" }]);
  expect(body.routingPreference).toBe("TRAFFIC_UNAWARE");
  expect(body.travelMode).toBe("DRIVE");
  expect(init.cache).toBe("no-store");
  expect(init.headers["X-Goog-FieldMask"]).toBe(
    "routes.legs.duration,routes.legs.distanceMeters",
  );
  expect(init.body).not.toContain("polyline");
});
it.each(
  [
    [],
    [{ duration: "10s" }],
    [{}, { duration: "10s" }],
    [{ duration: "-1s" }, { duration: "10s" }],
    [{ duration: "oops" }, { duration: "10s" }],
  ].map((legs) => ({ legs })),
)("rejects incomplete routes: %j", async ({ legs }) => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ routes: [{ legs }] }));
  await expect(
    googleSiteTravelProvider(fetcher, "fixture")(
      "place",
      new AbortController().signal,
    ),
  ).rejects.toThrow();
});
it("makes zero calls when not configured", async () => {
  const fetcher = vi.fn();
  await expect(
    googleSiteTravelProvider(fetcher, "")(
      "place",
      new AbortController().signal,
    ),
  ).rejects.toThrow(/not configured/);
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not disclose unexpected provider/network payloads", async () => {
  const fetcher = vi.fn().mockRejectedValue(Error("private-provider-response"));
  await expect(
    googleSiteTravelProvider(fetcher, "fixture")(
      "place",
      new AbortController().signal,
    ),
  ).rejects.toThrow(
    "The driving route is unavailable. Retry travel calculation.",
  );
});
