// @vitest-environment node

import { describe, expect, it } from "vitest";
import { projectDesignBookletErrorResponse } from "./projectApi";
import { DesignBookletImageProcessorUnavailableError } from "./sharpRuntime";

describe("project design booklet API errors", () => {
  it("returns a private controlled 503 for native image processor failures", async () => {
    const response = projectDesignBookletErrorResponse(
      new DesignBookletImageProcessorUnavailableError(),
      "The design booklet PDF could not be generated.",
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    await expect(response.json()).resolves.toMatchObject({
      error: "Image processing is temporarily unavailable.",
      code: "image_processor_unavailable",
    });
  });
});
