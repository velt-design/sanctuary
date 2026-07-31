"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  TONI_DESIGN_BOOKLET_ASSETS,
  createToniDesignBookletDraft,
} from "@/lib/designBooklets/defaults";
import { compressDesignBookletImage } from "@/lib/designBooklets/imageCompression";
import { allDesignBookletAssetSources } from "@/lib/designBooklets/pageModel";
import {
  copyProjectDesignBookletAssetClient,
  loadProjectDesignBookletClient,
  saveProjectDesignBookletClient,
  uploadProjectDesignBookletAssetClient,
} from "@/lib/designBooklets/projectClient";
import type {
  ProjectDesignBookletAsset,
  ProjectDesignBookletSaveState,
  ProjectDesignBookletSnapshot,
} from "@/lib/designBooklets/projectTypes";
import type {
  DesignBookletAssetSource,
  DesignBookletDraft,
} from "@/lib/designBooklets/types";
import type { DesignBookletPreviewAsset } from "./DesignBookletPages";

type DesignBookletAssetMap = Record<
  string,
  DesignBookletPreviewAsset
>;

export function previewAssetFromSource(
  source: DesignBookletAssetSource,
): DesignBookletPreviewAsset {
  const defaultAsset = TONI_DESIGN_BOOKLET_ASSETS[source.defaultAssetId];
  return {
    id: source.assetId,
    src: defaultAsset.src,
    alt: source.altText,
    label: defaultAsset.label,
    defaultAssetId: source.defaultAssetId,
  };
}

function initialDesignBookletAssets(
  draft: DesignBookletDraft,
): DesignBookletAssetMap {
  return Object.fromEntries(
    allDesignBookletAssetSources(draft).map((source) => [
      source.assetId,
      previewAssetFromSource(source),
    ]),
  );
}

function persistedPreviewAsset(
  source: DesignBookletAssetSource,
  asset: ProjectDesignBookletAsset,
): DesignBookletPreviewAsset {
  return {
    id: source.assetId,
    src: asset.src,
    alt: source.altText,
    label: asset.label,
    defaultAssetId: source.defaultAssetId,
  };
}

function snapshotAssets(
  snapshot: ProjectDesignBookletSnapshot,
): DesignBookletAssetMap {
  const next = initialDesignBookletAssets(snapshot.draft);
  const sources = new Map(
    allDesignBookletAssetSources(snapshot.draft).map((source) => [
      source.assetId,
      source,
    ]),
  );
  for (const asset of snapshot.assets) {
    const source = sources.get(asset.assetId);
    if (source) next[asset.assetId] = persistedPreviewAsset(source, asset);
  }
  return next;
}

type ProjectDesignBookletContext = ProjectDesignBookletSnapshot["project"];

export function useProjectDesignBookletController(projectId?: string) {
  const linkedProjectId = projectId?.trim() || null;
  const [draft, setDraft] = useState(createToniDesignBookletDraft);
  const [assets, setAssets] = useState<DesignBookletAssetMap>(() =>
    initialDesignBookletAssets(createToniDesignBookletDraft()),
  );
  const [project, setProject] = useState<ProjectDesignBookletContext | null>(
    null,
  );
  const [saveState, setSaveState] = useState<ProjectDesignBookletSaveState>(
    linkedProjectId ? "loading" : "standalone",
  );
  const [persistenceError, setPersistenceError] = useState("");
  const blobUrlsRef = useRef(new Set<string>());
  const loadedRef = useRef(!linkedProjectId);
  const revisionRef = useRef(0);
  const draftRef = useRef(draft);
  const lastSavedDraftRef = useRef(
    linkedProjectId ? "" : JSON.stringify(draft),
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const revokeAssetUrl = useCallback(
    (asset: DesignBookletPreviewAsset | undefined) => {
      if (!asset?.src.startsWith("blob:")) return;
      URL.revokeObjectURL(asset.src);
      blobUrlsRef.current.delete(asset.src);
    },
    [],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  useEffect(() => {
    if (!linkedProjectId) return;
    let cancelled = false;
    loadedRef.current = false;
    setSaveState("loading");
    setPersistenceError("");

    void loadProjectDesignBookletClient(linkedProjectId)
      .then((snapshot) => {
        if (cancelled) return;
        for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
        blobUrlsRef.current.clear();
        revisionRef.current = snapshot.revision;
        draftRef.current = snapshot.draft;
        lastSavedDraftRef.current = snapshot.saved
          ? JSON.stringify(snapshot.draft)
          : "";
        setDraft(snapshot.draft);
        setAssets(snapshotAssets(snapshot));
        setProject(snapshot.project);
        loadedRef.current = true;
        setSaveState(snapshot.saved ? "saved" : "saving");
      })
      .catch((error) => {
        if (cancelled) return;
        loadedRef.current = false;
        setSaveState("error");
        setPersistenceError(
          error instanceof Error
            ? error.message
            : "The project booklet could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [linkedProjectId]);

  const queueSave = useCallback(
    (nextDraft: DesignBookletDraft): Promise<void> => {
      if (!linkedProjectId || !loadedRef.current) return Promise.resolve();
      const serialized = JSON.stringify(nextDraft);
      if (serialized === lastSavedDraftRef.current) {
        return saveQueueRef.current;
      }
      setSaveState("saving");
      setPersistenceError("");
      const operation = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await saveProjectDesignBookletClient(
            linkedProjectId,
            nextDraft,
            revisionRef.current,
          );
          revisionRef.current = saved.revision;
          lastSavedDraftRef.current = serialized;
          if (JSON.stringify(draftRef.current) === serialized) {
            setSaveState("saved");
          }
        })
        .catch((error) => {
          setSaveState("error");
          setPersistenceError(
            error instanceof Error
              ? error.message
              : "The project booklet could not be saved.",
          );
          throw error;
        });
      saveQueueRef.current = operation;
      return operation;
    },
    [linkedProjectId],
  );

  useEffect(() => {
    if (!linkedProjectId || !loadedRef.current) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedDraftRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void queueSave(draft).catch(() => undefined);
    }, 700);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [draft, linkedProjectId, queueSave]);

  const flushSave = useCallback(async (): Promise<void> => {
    if (!linkedProjectId || !loadedRef.current) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await queueSave(draftRef.current);
    await saveQueueRef.current;
  }, [linkedProjectId, queueSave]);

  const replaceAsset = useCallback(
    async (assetId: string, file: File | undefined): Promise<void> => {
      if (!file) return;
      if (!["image/png", "image/jpeg"].includes(file.type)) {
        setPersistenceError("Choose a PNG or JPEG image.");
        setSaveState(linkedProjectId ? "error" : "standalone");
        return;
      }
      const existing = assets[assetId];
      if (!existing) return;

      if (!linkedProjectId) {
        const src = URL.createObjectURL(file);
        blobUrlsRef.current.add(src);
        revokeAssetUrl(existing);
        setAssets((current) => ({
          ...current,
          [assetId]: {
            ...current[assetId],
            src,
            file,
            label: file.name,
          },
        }));
        setPersistenceError("");
        return;
      }

      setSaveState("uploading");
      setPersistenceError("");
      try {
        const compressed = await compressDesignBookletImage(file);
        const localSrc = URL.createObjectURL(compressed);
        blobUrlsRef.current.add(localSrc);
        revokeAssetUrl(existing);
        setAssets((current) => ({
          ...current,
          [assetId]: {
            ...current[assetId],
            src: localSrc,
            file: compressed,
            label: file.name,
          },
        }));

        const saved = await uploadProjectDesignBookletAssetClient(
          linkedProjectId,
          assetId,
          compressed,
        );
        setAssets((current) => {
          const source = allDesignBookletAssetSources(draftRef.current).find(
            (candidate) => candidate.assetId === assetId,
          );
          const currentAsset = current[assetId];
          if (!source || !currentAsset) return current;
          revokeAssetUrl(currentAsset);
          return {
            ...current,
            [assetId]: persistedPreviewAsset(source, saved),
          };
        });
        setSaveState(
          JSON.stringify(draftRef.current) === lastSavedDraftRef.current
            ? "saved"
            : "saving",
        );
      } catch (error) {
        setSaveState("error");
        setPersistenceError(
          error instanceof Error ? error.message : "The image could not be saved.",
        );
      }
    },
    [assets, linkedProjectId, revokeAssetUrl],
  );

  const copyAsset = useCallback(
    async (sourceAssetId: string, targetAssetId: string): Promise<void> => {
      const sourceAsset = assets[sourceAssetId];
      const targetAsset = assets[targetAssetId];
      if (!sourceAsset || !targetAsset) return;

      if (!linkedProjectId) {
        const src = sourceAsset.file
          ? URL.createObjectURL(sourceAsset.file)
          : sourceAsset.src;
        if (sourceAsset.file) blobUrlsRef.current.add(src);
        revokeAssetUrl(targetAsset);
        setAssets((current) => ({
          ...current,
          [targetAssetId]: {
            ...sourceAsset,
            id: targetAssetId,
            src,
          },
        }));
        return;
      }

      setSaveState("uploading");
      setPersistenceError("");
      try {
        const saved = await copyProjectDesignBookletAssetClient(
          linkedProjectId,
          sourceAssetId,
          targetAssetId,
          sourceAsset.defaultAssetId,
        );
        const targetSource = allDesignBookletAssetSources(draftRef.current).find(
          (candidate) => candidate.assetId === targetAssetId,
        );
        if (!targetSource) return;
        revokeAssetUrl(targetAsset);
        setAssets((current) => ({
          ...current,
          [targetAssetId]: persistedPreviewAsset(targetSource, saved),
        }));
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setPersistenceError(
          error instanceof Error
            ? error.message
            : "The cover image could not be copied.",
        );
        throw error;
      }
    },
    [assets, linkedProjectId, revokeAssetUrl],
  );

  return {
    linkedProjectId,
    draft,
    setDraft,
    assets,
    setAssets: setAssets as Dispatch<SetStateAction<DesignBookletAssetMap>>,
    project,
    saveState,
    persistenceError,
    setPersistenceError,
    revokeAssetUrl,
    replaceAsset,
    copyAsset,
    flushSave,
  };
}
