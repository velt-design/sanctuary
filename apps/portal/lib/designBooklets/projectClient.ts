import type {
  ProjectDesignBookletAsset,
  ProjectDesignBookletSnapshot,
} from "./projectTypes";
import type { DesignBookletDefaultAssetId, DesignBookletDraft } from "./types";

type ApiErrorPayload = { error?: string; code?: string };

async function apiPayload<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & ApiErrorPayload)
    | null;
  if (!response.ok) {
    const error = new Error(payload?.error || fallback) as Error & {
      code?: string;
      status?: number;
    };
    error.code = payload?.code;
    error.status = response.status;
    throw error;
  }
  if (!payload) throw new Error(fallback);
  return payload;
}

function endpoint(projectId: string, suffix = ""): string {
  return `/api/staff/v1/projects/${encodeURIComponent(projectId)}/design-booklet${suffix}`;
}

export async function loadProjectDesignBookletClient(
  projectId: string,
): Promise<ProjectDesignBookletSnapshot> {
  const response = await fetch(endpoint(projectId), {
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await apiPayload<{ snapshot: ProjectDesignBookletSnapshot }>(
    response,
    "The project booklet could not be loaded.",
  );
  return payload.snapshot;
}

export async function saveProjectDesignBookletClient(
  projectId: string,
  draft: DesignBookletDraft,
  expectedRevision: number,
): Promise<{ revision: number; updatedAt: string }> {
  const response = await fetch(endpoint(projectId), {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, expectedRevision }),
  });
  const payload = await apiPayload<{
    saved: { revision: number; updatedAt: string };
  }>(response, "The project booklet could not be saved.");
  return payload.saved;
}

export async function uploadProjectDesignBookletAssetClient(
  projectId: string,
  assetId: string,
  file: File,
): Promise<ProjectDesignBookletAsset> {
  const signResponse = await fetch(endpoint(projectId, "/assets/sign"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, mediaType: file.type }),
  });
  const signed = await apiPayload<{
    upload: { path: string; signedUrl: string };
  }>(signResponse, "The asset upload could not be prepared.");

  const uploadResponse = await fetch(signed.upload.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "max-age=3600",
      "x-upsert": "false",
    },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("The asset could not be uploaded.");
  }

  const completeResponse = await fetch(
    endpoint(projectId, "/assets/complete"),
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        path: signed.upload.path,
        fileName: file.name,
        mediaType: file.type,
      }),
    },
  );
  const completed = await apiPayload<{ asset: ProjectDesignBookletAsset }>(
    completeResponse,
    "The asset could not be saved.",
  );
  return completed.asset;
}

export async function copyProjectDesignBookletAssetClient(
  projectId: string,
  sourceAssetId: string,
  targetAssetId: string,
  sourceDefaultAssetId: DesignBookletDefaultAssetId,
): Promise<ProjectDesignBookletAsset> {
  const response = await fetch(endpoint(projectId, "/assets/copy"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceAssetId,
      targetAssetId,
      sourceDefaultAssetId,
    }),
  });
  const payload = await apiPayload<{ asset: ProjectDesignBookletAsset }>(
    response,
    "The cover image could not be copied.",
  );
  return payload.asset;
}

export async function publishProjectDesignBookletPdfClient(
  projectId: string,
): Promise<{ downloadUrl: string; filename: string }> {
  const response = await fetch(endpoint(projectId, "/pdf"), {
    method: "POST",
    credentials: "same-origin",
  });
  const payload = await apiPayload<{
    download: { downloadUrl: string; filename: string };
  }>(response, "The PDF could not be generated.");
  return payload.download;
}
