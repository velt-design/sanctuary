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
  createProjectDesignBookletDraft,
  createToniDesignBookletDraft,
  neutralizeProjectDesignBookletMedia,
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
import type {
  DesignBookletPreviewAsset,
  DesignBookletPreviewAssetState,
} from "./previewAssets";

type DesignBookletAssetMap = Record<string, DesignBookletPreviewAsset>;

export function previewAssetFromSource(
  source: DesignBookletAssetSource,
): DesignBookletPreviewAsset {
  const defaultAsset = TONI_DESIGN_BOOKLET_ASSETS[source.defaultAssetId];
  const useDefaultAsset = source.useDefaultAsset !== false;
  return {
    id: source.assetId,
    src: useDefaultAsset ? defaultAsset.src : "",
    alt: source.altText,
    label: useDefaultAsset ? defaultAsset.label : "No image selected",
    defaultAssetId: source.defaultAssetId,
    state: useDefaultAsset ? "loading" : "empty",
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
    state: "loading",
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
  const [draft, setDraft] = useState(() =>
    linkedProjectId
      ? createProjectDesignBookletDraft()
      : createToniDesignBookletDraft(),
  );
  const [assets, setAssets] = useState<DesignBookletAssetMap>(() =>
    initialDesignBookletAssets(
      linkedProjectId
        ? createProjectDesignBookletDraft()
        : createToniDesignBookletDraft(),
    ),
  );
  const [project, setProject] = useState<ProjectDesignBookletContext | null>(
    null,
  );
  const [saveState, setSaveState] = useState<ProjectDesignBookletSaveState>(
    linkedProjectId ? "loading" : "standalone",
  );
  const [persistenceError, setPersistenceError] = useState("");
  const blobUrlsRef = useRef(new Set<string>());
  const assetLoadersRef = useRef(new Map<string, HTMLImageElement>());
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

  const markAssetDisplayState = useCallback(
    (
      assetId: string,
      src: string,
      state: Extract<DesignBookletPreviewAssetState, "ready" | "error">,
    ) => {
      setAssets((current) => {
        const asset = current[assetId];
        if (!asset || asset.src !== src || asset.state === state)
          return current;
        return {
          ...current,
          [assetId]: {
            ...asset,
            state,
            errorMessage:
              state === "error" ? "Image could not be displayed" : undefined,
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    const activeKeys = new Set<string>();
    for (const asset of Object.values(assets)) {
      if (asset.state !== "loading" || !asset.src) continue;
      const key = `${asset.id}\u0000${asset.src}`;
      activeKeys.add(key);
      if (assetLoadersRef.current.has(key)) continue;
      const image = new Image();
      image.onload = () => {
        assetLoadersRef.current.delete(key);
        markAssetDisplayState(asset.id, asset.src, "ready");
      };
      image.onerror = () => {
        assetLoadersRef.current.delete(key);
        markAssetDisplayState(asset.id, asset.src, "error");
      };
      assetLoadersRef.current.set(key, image);
      image.src = asset.src;
    }
    for (const [key, image] of assetLoadersRef.current) {
      if (activeKeys.has(key)) continue;
      image.onload = null;
      image.onerror = null;
      assetLoadersRef.current.delete(key);
    }
  }, [assets, markAssetDisplayState]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      for (const image of assetLoadersRef.current.values()) {
        image.onload = null;
        image.onerror = null;
      }
      assetLoadersRef.current.clear();
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
        const projectDraft = neutralizeProjectDesignBookletMedia(
          snapshot.draft,
        );
        const projectSnapshot = { ...snapshot, draft: projectDraft };
        for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
        blobUrlsRef.current.clear();
        revisionRef.current = snapshot.revision;
        draftRef.current = projectDraft;
        lastSavedDraftRef.current = snapshot.saved
          ? JSON.stringify(projectDraft)
          : "";
        setDraft(projectDraft);
        setAssets(snapshotAssets(projectSnapshot));
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

      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          state: "loading",
          errorMessage: undefined,
          label: file.name,
        },
      }));

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
            state: "loading",
            errorMessage: undefined,
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
            state: "loading",
            errorMessage: undefined,
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
        const message =
          error instanceof Error
            ? error.message
            : "The image could not be saved.";
        setAssets((current) => ({
          ...current,
          [assetId]: {
            ...current[assetId],
            state: "error",
            errorMessage: message,
          },
        }));
        setPersistenceError(message);
      }
    },
    [assets, linkedProjectId, revokeAssetUrl],
  );

  const copyAsset = useCallback(
    async (sourceAssetId: string, targetAssetId: string): Promise<void> => {
      const sourceAsset = assets[sourceAssetId];
      const targetAsset = assets[targetAssetId];
      if (!sourceAsset || !targetAsset || !sourceAsset.src) return;

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
            state: "loading",
            errorMessage: undefined,
          },
        }));
        return;
      }

      setSaveState("uploading");
      setPersistenceError("");
      setAssets((current) => ({
        ...current,
        [targetAssetId]: {
          ...current[targetAssetId],
          state: "loading",
          errorMessage: undefined,
        },
      }));
      try {
        const saved = await copyProjectDesignBookletAssetClient(
          linkedProjectId,
          sourceAssetId,
          targetAssetId,
          sourceAsset.defaultAssetId,
        );
        const targetSource = allDesignBookletAssetSources(
          draftRef.current,
        ).find((candidate) => candidate.assetId === targetAssetId);
        if (!targetSource) return;
        revokeAssetUrl(targetAsset);
        setAssets((current) => ({
          ...current,
          [targetAssetId]: persistedPreviewAsset(targetSource, saved),
        }));
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        const message =
          error instanceof Error
            ? error.message
            : "The cover image could not be copied.";
        setAssets((current) => ({
          ...current,
          [targetAssetId]: {
            ...current[targetAssetId],
            state: "error",
            errorMessage: message,
          },
        }));
        setPersistenceError(message);
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
    markAssetDisplayState,
    revokeAssetUrl,
    replaceAsset,
    copyAsset,
    flushSave,
  };
}
