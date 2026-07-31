import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyProjectDesignBookletAssetClient,
  publishProjectDesignBookletPdfClient,
  uploadProjectDesignBookletAssetClient,
} from "./projectClient";

describe("project design booklet client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a single prepared image directly to private storage before completing it", async () => {
    const file = new File(["compressed"], "render.jpg", {
      type: "image/jpeg",
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          upload: {
            path: "project/images/image-1/file.jpg",
            signedUrl: "https://storage.example.test/signed-upload",
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ Key: "stored" }))
      .mockResolvedValueOnce(
        Response.json({
          asset: {
            assetId: "image-1",
            src: "https://storage.example.test/signed-read",
            label: "render.jpg",
            mediaType: "image/jpeg",
            byteSize: file.size,
            width: 1600,
            height: 900,
            updatedAt: "2026-07-31T00:00:00.000Z",
          },
        }),
      );

    const asset = await uploadProjectDesignBookletAssetClient(
      "proj_1",
      "image-1",
      file,
    );

    expect(asset.assetId).toBe("image-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://storage.example.test/signed-upload",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: file,
    });
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/projects/proj_1/design-booklet/assets/complete",
    );
  });

  it("requests a short-lived project PDF link instead of downloading PDF bytes through the function", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        download: {
          downloadUrl: "https://storage.example.test/booklet.pdf?token=short",
          filename: "client-design-booklet.pdf",
        },
      }),
    );

    const result = await publishProjectDesignBookletPdfClient("proj_1");

    expect(result.filename).toBe("client-design-booklet.pdf");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/v1/projects/proj_1/design-booklet/pdf",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("includes the governed default fallback when copying an image to the cover", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        asset: {
          assetId: "cover-image",
          src: "https://storage.example.test/cover.jpg?token=short",
          label: "booklet-toni-01.png",
          mediaType: "image/jpeg",
          byteSize: 100,
          width: 1600,
          height: 900,
          updatedAt: "2026-07-31T00:00:00.000Z",
        },
      }),
    );

    await copyProjectDesignBookletAssetClient(
      "proj_1",
      "image-page-1-image",
      "cover-image",
      "render-1",
    );

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      sourceAssetId: "image-page-1-image",
      targetAssetId: "cover-image",
      sourceDefaultAssetId: "render-1",
    });
  });
});
