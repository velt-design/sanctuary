"use client";

import { useCallback, useMemo, useRef } from "react";
import { renderableDesignBookletAssetSources } from "@/lib/designBooklets/pageModel";
import { publishProjectDesignBookletPdfClient } from "@/lib/designBooklets/projectClient";
import type { DesignBookletDraft } from "@/lib/designBooklets/types";
import type { DesignBookletPreviewAsset } from "./previewAssets";

type DesignBookletPdfArtifact = {
  key: string;
  blob: Blob;
  filename: string;
};

class StaleDesignBookletPdfRequest extends Error {
  constructor() {
    super("The booklet changed while the PDF was being prepared. Try again.");
    this.name = "StaleDesignBookletPdfRequest";
  }
}

type Input = {
  draft: DesignBookletDraft;
  assets: Record<string, DesignBookletPreviewAsset>;
  linkedProjectId: string | null;
  pdfEndpoint: string;
  flushSave: () => Promise<void>;
};

function filenameFromResponse(
  response: Response,
  customerName: string,
): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  if (match?.[1]) return match[1];
  const slug =
    customerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "customer";
  return `${slug}-design-booklet.pdf`;
}

function designBookletPdfArtifactKey(
  draft: DesignBookletDraft,
  assets: Record<string, DesignBookletPreviewAsset>,
): string {
  const assetState = renderableDesignBookletAssetSources(draft).map(
    (source) => {
      const asset = assets[source.assetId];
      return {
        assetId: source.assetId,
        src: asset?.src ?? "",
        file: asset?.file
          ? {
              name: asset.file.name,
              size: asset.file.size,
              type: asset.file.type,
              lastModified: asset.file.lastModified,
            }
          : null,
      };
    },
  );
  return JSON.stringify({ draft, assetState });
}

async function responsePdfBlob(
  response: Response,
  fallback: string,
): Promise<Blob> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error || fallback);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error(fallback);
  return blob;
}

export function useDesignBookletPdfArtifact({
  draft,
  assets,
  linkedProjectId,
  pdfEndpoint,
  flushSave,
}: Input) {
  const key = useMemo(
    () => designBookletPdfArtifactKey(draft, assets),
    [assets, draft],
  );
  const keyRef = useRef(key);
  const artifactRef = useRef<DesignBookletPdfArtifact | null>(null);
  const inFlightRef = useRef<{
    key: string;
    promise: Promise<DesignBookletPdfArtifact>;
  } | null>(null);
  const generationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const requestSequenceRef = useRef(0);
  keyRef.current = key;

  const prepare = useCallback(async (): Promise<DesignBookletPdfArtifact> => {
    const requestedKey = key;
    if (artifactRef.current?.key === requestedKey) {
      return artifactRef.current;
    }
    if (inFlightRef.current?.key === requestedKey) {
      return inFlightRef.current.promise;
    }

    const draftSnapshot = draft;
    const assetsSnapshot = assets;
    const requestSequence = ++requestSequenceRef.current;

    const assertCurrentRequest = () => {
      if (
        requestSequence !== requestSequenceRef.current ||
        keyRef.current !== requestedKey
      ) {
        throw new StaleDesignBookletPdfRequest();
      }
    };

    const generate = async () => {
      assertCurrentRequest();
      let blob: Blob;
      let filename: string;

      if (linkedProjectId) {
        await flushSave();
        assertCurrentRequest();
        const published =
          await publishProjectDesignBookletPdfClient(linkedProjectId);
        const response = await fetch(published.downloadUrl, {
          cache: "no-store",
          credentials: "omit",
        });
        blob = await responsePdfBlob(
          response,
          "The generated PDF could not be loaded.",
        );
        filename = published.filename;
      } else {
        const formData = new FormData();
        formData.set("draft", JSON.stringify(draftSnapshot));
        for (const source of renderableDesignBookletAssetSources(
          draftSnapshot,
        )) {
          const asset = assetsSnapshot[source.assetId];
          if (asset?.file) formData.set(`asset:${source.assetId}`, asset.file);
        }
        const response = await fetch(pdfEndpoint, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        blob = await responsePdfBlob(
          response,
          "The PDF could not be generated.",
        );
        filename = filenameFromResponse(response, draftSnapshot.customerName);
      }

      return {
        key: requestedKey,
        blob,
        filename,
      };
    };

    // Project PDFs are published to a stable latest.pdf path. Serialising every
    // generation prevents an older request from finishing last and overwriting
    // the latest authoritative download.
    const promise = generationQueueRef.current.then(generate, generate);
    generationQueueRef.current = promise.then(
      () => undefined,
      () => undefined,
    );

    inFlightRef.current = { key: requestedKey, promise };
    try {
      const nextArtifact = await promise;
      if (keyRef.current === requestedKey) {
        artifactRef.current = nextArtifact;
      }
      return nextArtifact;
    } catch (caught) {
      if (caught instanceof StaleDesignBookletPdfRequest) throw caught;
      throw caught;
    } finally {
      if (inFlightRef.current?.promise === promise) inFlightRef.current = null;
    }
  }, [assets, draft, flushSave, key, linkedProjectId, pdfEndpoint]);

  const download = useCallback(async () => {
    const currentArtifact =
      artifactRef.current?.key === key ? artifactRef.current : await prepare();
    if (currentArtifact.key !== keyRef.current) {
      throw new Error(
        "The booklet changed while the PDF was being prepared. Try again.",
      );
    }
    const url = URL.createObjectURL(currentArtifact.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = currentArtifact.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [key, prepare]);

  return { download };
}
