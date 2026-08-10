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
import { designBookletDrawingPdfAssetId } from "@/lib/designBooklets/pageModel";
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
  DesignBookletDrawingItem,
} from "@/lib/designBooklets/types";
import type {
  DesignBookletPreviewAsset,
  DesignBookletPreviewAssetState,
} from "./previewAssets";
import { preloadDesignBookletImage } from "./preloadDesignBookletImage";
import { renderDesignBookletPdfPreview } from "./renderDesignBookletPdfPreview";

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
  const persistedById = new Map(
    snapshot.assets.map((asset) => [asset.assetId, asset]),
  );
  for (const page of snapshot.draft.contentPages) {
    if (page.kind !== "drawings") continue;
    for (const drawing of page.drawings) {
      if (!drawing.pdf) continue;
      const preview = next[drawing.image.assetId];
      const document = persistedById.get(drawing.pdf.assetId);
      if (preview && document?.mediaType === "application/pdf") {
        next[drawing.image.assetId] = {
          ...preview,
          sourcePdfSrc: document.src,
        };
      }
    }
  }
  return next;
}

function drawingFromDraft(
  draft: DesignBookletDraft,
  drawingId: string,
): DesignBookletDrawingItem | null {
  for (const page of draft.contentPages) {
    if (page.kind !== "drawings") continue;
    const drawing = page.drawings.find(
      (candidate) => candidate.id === drawingId,
    );
    if (drawing) return drawing;
  }
  return null;
}

function updateDraftDrawing(
  draft: DesignBookletDraft,
  drawingId: string,
  update: (drawing: DesignBookletDrawingItem) => DesignBookletDrawingItem,
): DesignBookletDraft {
  return {
    ...draft,
    contentPages: draft.contentPages.map((page) =>
      page.kind !== "drawings"
        ? page
        : {
            ...page,
            drawings: page.drawings.map((drawing) =>
              drawing.id === drawingId ? update(drawing) : drawing,
            ) as typeof page.drawings,
          },
    ),
  };
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
  const assetUploadQueuesRef = useRef(new Map<string, Promise<void>>());
  const assetReplacementSequenceRef = useRef(new Map<string, number>());
  const pendingAssetOperationsRef = useRef(0);
  const assetOperationErrorRef = useRef<Error | null>(null);

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
          while (assetUploadQueuesRef.current.size > 0) {
            await Promise.all([...assetUploadQueuesRef.current.values()]);
          }
          if (assetOperationErrorRef.current) {
            throw assetOperationErrorRef.current;
          }
          const saved = await saveProjectDesignBookletClient(
            linkedProjectId,
            nextDraft,
            revisionRef.current,
          );
          revisionRef.current = saved.revision;
          lastSavedDraftRef.current = serialized;
          if (JSON.stringify(draftRef.current) === serialized) {
            setSaveState(
              pendingAssetOperationsRef.current > 0 ? "uploading" : "saved",
            );
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
    while (assetUploadQueuesRef.current.size > 0) {
      await Promise.all([...assetUploadQueuesRef.current.values()]);
    }
    if (assetOperationErrorRef.current) throw assetOperationErrorRef.current;
    await queueSave(draftRef.current);
    await saveQueueRef.current;
  }, [linkedProjectId, queueSave]);

  const enqueueAssetOperation = useCallback(
    async (
      assetId: string,
      run: (isLatest: () => boolean) => Promise<void>,
      failureMessage: string,
      requestedSequence?: number,
    ): Promise<void> => {
      const sequence =
        requestedSequence ??
        (assetReplacementSequenceRef.current.get(assetId) ?? 0) + 1;
      assetReplacementSequenceRef.current.set(assetId, sequence);
      pendingAssetOperationsRef.current += 1;
      assetOperationErrorRef.current = null;
      setSaveState("uploading");
      const previousOperation =
        assetUploadQueuesRef.current.get(assetId) ?? Promise.resolve();
      const isLatest = () =>
        assetReplacementSequenceRef.current.get(assetId) === sequence;
      let operation: Promise<void>;
      operation = previousOperation
        .catch(() => undefined)
        .then(() => run(isLatest))
        .catch((error) => {
          if (!isLatest()) return;
          const failure =
            error instanceof Error ? error : new Error(failureMessage);
          assetOperationErrorRef.current = failure;
          setSaveState("error");
          setPersistenceError(failure.message);
        })
        .finally(() => {
          pendingAssetOperationsRef.current = Math.max(
            0,
            pendingAssetOperationsRef.current - 1,
          );
          if (assetUploadQueuesRef.current.get(assetId) === operation) {
            assetUploadQueuesRef.current.delete(assetId);
          }
          if (
            isLatest() &&
            pendingAssetOperationsRef.current === 0 &&
            !assetOperationErrorRef.current
          ) {
            setSaveState(
              JSON.stringify(draftRef.current) === lastSavedDraftRef.current
                ? "saved"
                : "saving",
            );
          }
        });
      assetUploadQueuesRef.current.set(assetId, operation);
      await operation;
    },
    [],
  );

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

      const localSrc = URL.createObjectURL(file);
      blobUrlsRef.current.add(localSrc);
      revokeAssetUrl(existing);
      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          src: localSrc,
          file,
          label: file.name,
          state: "loading",
          errorMessage: undefined,
        },
      }));
      setPersistenceError("");

      if (!linkedProjectId) {
        setPersistenceError("");
        return;
      }

      await enqueueAssetOperation(
        assetId,
        async (isLatest) => {
          const compressed = await compressDesignBookletImage(file);
          const saved = await uploadProjectDesignBookletAssetClient(
            linkedProjectId,
            assetId,
            compressed,
          );
          if (!isLatest()) return;

          // Keep the instant local preview visible until the durable signed
          // source has loaded. The swap is then atomic, so a slow network or
          // CSP failure cannot replace a working preview with a broken image.
          await preloadDesignBookletImage(saved.src);
          if (!isLatest()) return;
          setAssets((current) => {
            const source = allDesignBookletAssetSources(draftRef.current).find(
              (candidate) => candidate.assetId === assetId,
            );
            const currentAsset = current[assetId];
            if (!source || !currentAsset || currentAsset.src !== localSrc) {
              return current;
            }
            revokeAssetUrl(currentAsset);
            return {
              ...current,
              [assetId]: {
                ...persistedPreviewAsset(source, saved),
                state: "ready",
              },
            };
          });
        },
        "The image could not be saved.",
      );
    },
    [assets, enqueueAssetOperation, linkedProjectId, revokeAssetUrl],
  );

  const replaceDrawingPdf = useCallback(
    async (drawingId: string, file: File | undefined): Promise<void> => {
      if (!file) return;
      if (file.type !== "application/pdf") {
        setPersistenceError("Choose a PDF drawing.");
        setSaveState(linkedProjectId ? "error" : "standalone");
        return;
      }
      const drawing = drawingFromDraft(draftRef.current, drawingId);
      if (!drawing) return;
      const assetId = drawing.image.assetId;
      const existing = assets[assetId];
      if (!existing) return;
      const sequence =
        (assetReplacementSequenceRef.current.get(assetId) ?? 0) + 1;
      assetReplacementSequenceRef.current.set(assetId, sequence);
      const isLatest = () =>
        assetReplacementSequenceRef.current.get(assetId) === sequence;
      setPersistenceError("");
      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          label: file.name,
          state: "loading",
          errorMessage: undefined,
        },
      }));

      let preview: Awaited<ReturnType<typeof renderDesignBookletPdfPreview>>;
      try {
        preview = await renderDesignBookletPdfPreview(file, file.name, 1);
      } catch (error) {
        if (!isLatest()) return;
        const message =
          error instanceof Error
            ? error.message
            : "The drawing PDF could not be previewed.";
        setAssets((current) => ({
          ...current,
          [assetId]: {
            ...current[assetId],
            state: "error",
            errorMessage: message,
          },
        }));
        setPersistenceError(message);
        setSaveState(linkedProjectId ? "error" : "standalone");
        return;
      }
      if (!isLatest()) return;

      const localSrc = URL.createObjectURL(preview.file);
      blobUrlsRef.current.add(localSrc);
      revokeAssetUrl(existing);
      const pdfAssetId =
        drawing.pdf?.assetId ?? designBookletDrawingPdfAssetId(drawing);
      const nextDraft = updateDraftDrawing(
        draftRef.current,
        drawingId,
        (current) => ({
          ...current,
          pdf: {
            assetId: pdfAssetId,
            fileName: file.name,
            pageNumber: 1,
            pageCount: preview.pageCount,
          },
        }),
      );
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          src: localSrc,
          file: preview.file,
          sourcePdfFile: file,
          sourcePdfSrc: undefined,
          label: file.name,
          state: "loading",
          errorMessage: undefined,
        },
      }));
      if (!linkedProjectId) return;

      await enqueueAssetOperation(
        assetId,
        async (operationIsLatest) => {
          const [savedDocument, savedPreview] = await Promise.all([
            uploadProjectDesignBookletAssetClient(
              linkedProjectId,
              pdfAssetId,
              file,
            ),
            uploadProjectDesignBookletAssetClient(
              linkedProjectId,
              assetId,
              preview.file,
            ),
          ]);
          if (savedDocument.pageCount !== preview.pageCount) {
            throw new Error(
              "The saved PDF page count did not match its preview.",
            );
          }
          if (!operationIsLatest()) return;
          await preloadDesignBookletImage(savedPreview.src);
          if (!operationIsLatest()) return;
          setAssets((current) => {
            const source = allDesignBookletAssetSources(draftRef.current).find(
              (candidate) => candidate.assetId === assetId,
            );
            const currentAsset = current[assetId];
            if (!source || !currentAsset || currentAsset.src !== localSrc) {
              return current;
            }
            revokeAssetUrl(currentAsset);
            return {
              ...current,
              [assetId]: {
                ...persistedPreviewAsset(source, savedPreview),
                sourcePdfSrc: savedDocument.src,
                state: "ready",
              },
            };
          });
        },
        "The drawing PDF could not be saved.",
        sequence,
      );
    },
    [assets, enqueueAssetOperation, linkedProjectId, revokeAssetUrl],
  );

  const selectDrawingPdfPage = useCallback(
    async (drawingId: string, pageNumber: number): Promise<void> => {
      const drawing = drawingFromDraft(draftRef.current, drawingId);
      if (!drawing?.pdf || drawing.pdf.pageNumber === pageNumber) return;
      if (
        !Number.isSafeInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > drawing.pdf.pageCount
      ) {
        setPersistenceError("Choose a valid PDF page.");
        return;
      }
      const assetId = drawing.image.assetId;
      const existing = assets[assetId];
      const pdfSource = existing?.sourcePdfFile ?? existing?.sourcePdfSrc;
      if (!existing || !pdfSource) {
        setPersistenceError("The drawing PDF source could not be opened.");
        return;
      }
      const sequence =
        (assetReplacementSequenceRef.current.get(assetId) ?? 0) + 1;
      assetReplacementSequenceRef.current.set(assetId, sequence);
      const isLatest = () =>
        assetReplacementSequenceRef.current.get(assetId) === sequence;
      setPersistenceError("");
      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          state: "loading",
          errorMessage: undefined,
        },
      }));

      let preview: Awaited<ReturnType<typeof renderDesignBookletPdfPreview>>;
      try {
        preview = await renderDesignBookletPdfPreview(
          pdfSource,
          drawing.pdf.fileName,
          pageNumber,
        );
      } catch (error) {
        if (!isLatest()) return;
        const message =
          error instanceof Error
            ? error.message
            : "The selected PDF page could not be previewed.";
        setAssets((current) => ({
          ...current,
          [assetId]: {
            ...current[assetId],
            state: "error",
            errorMessage: message,
          },
        }));
        setPersistenceError(message);
        return;
      }
      if (!isLatest()) return;

      const localSrc = URL.createObjectURL(preview.file);
      blobUrlsRef.current.add(localSrc);
      revokeAssetUrl(existing);
      const nextDraft = updateDraftDrawing(
        draftRef.current,
        drawingId,
        (current) => ({
          ...current,
          pdf: current.pdf
            ? { ...current.pdf, pageNumber, pageCount: preview.pageCount }
            : undefined,
        }),
      );
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setAssets((current) => ({
        ...current,
        [assetId]: {
          ...current[assetId],
          src: localSrc,
          file: preview.file,
          state: "loading",
          errorMessage: undefined,
        },
      }));
      if (!linkedProjectId) return;

      await enqueueAssetOperation(
        assetId,
        async (operationIsLatest) => {
          const savedPreview = await uploadProjectDesignBookletAssetClient(
            linkedProjectId,
            assetId,
            preview.file,
          );
          if (!operationIsLatest()) return;
          await preloadDesignBookletImage(savedPreview.src);
          if (!operationIsLatest()) return;
          setAssets((current) => {
            const source = allDesignBookletAssetSources(draftRef.current).find(
              (candidate) => candidate.assetId === assetId,
            );
            const currentAsset = current[assetId];
            if (!source || !currentAsset || currentAsset.src !== localSrc) {
              return current;
            }
            revokeAssetUrl(currentAsset);
            return {
              ...current,
              [assetId]: {
                ...persistedPreviewAsset(source, savedPreview),
                sourcePdfSrc: currentAsset.sourcePdfSrc,
                state: "ready",
              },
            };
          });
        },
        "The selected PDF page could not be saved.",
        sequence,
      );
    },
    [assets, enqueueAssetOperation, linkedProjectId, revokeAssetUrl],
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
    replaceDrawingPdf,
    selectDrawingPdfPage,
    copyAsset,
    flushSave,
  };
}
