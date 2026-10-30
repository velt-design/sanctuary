"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiJson } from "@/lib/repo/apiClient";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioPackageFile } from "@/lib/designStudio/clientPackage";
import type { CapturedStudioViews } from "./StudioQuoteViews";
const Views = dynamic(() => import("./StudioQuoteViews"), {
  ssr: false,
  loading: () => <p role="status">Opening frozen design views…</p>,
});
export default function StudioRenderedViews({
  endpoint,
  onAdded,
  lifetime,
}: {
  endpoint: string;
  onAdded: (file: StudioPackageFile) => void;
  lifetime?: AbortSignal;
}) {
  const [edit, setEdit] = useState<StudioAuthoringEdit | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(),
      retire = () => controller.abort();
    lifetime?.addEventListener("abort", retire, { once: true });
    if (lifetime?.aborted) retire();
    setError(null);
    void apiJson<{ edit: StudioAuthoringEdit }>(`${endpoint}/frozen-source`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setEdit(result.edit);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("The frozen design could not be opened.");
      });
    return () => {
      controller.abort();
      lifetime?.removeEventListener("abort", retire);
    };
  }, [endpoint, lifetime, attempt]);
  async function captured(images: CapturedStudioViews) {
    if (busy || lifetime?.aborted) return;
    setBusy(true);
    setError(null);
    try {
      for (const image of images) {
        const result = await apiJson<{ file: StudioPackageFile }>(
          `${endpoint}/assets`,
          {
            method: "POST",
            body: JSON.stringify({
              filename:
                image.kind === "perspective"
                  ? "Design perspective.png"
                  : "Design plan.png",
              contentType: "image/png",
              contentBase64: image.dataUrl.split(",")[1],
            }),
            signal: lifetime,
          },
        );
        if (lifetime?.aborted) return;
        onAdded(result.file);
      }
    } catch (e) {
      if (!lifetime?.aborted)
        setError(
          e instanceof Error ? e.message : "The views could not be saved.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {edit ? (
        <Views
          edit={edit}
          onCapture={(images) => void captured(images)}
          disabled={busy}
          documentTarget="booklet"
        />
      ) : !error ? (
        <p role="status">Opening the frozen design…</p>
      ) : null}
      {busy && <p role="status">Saving views…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Retry views</button>
        </p>
      )}
    </div>
  );
}
