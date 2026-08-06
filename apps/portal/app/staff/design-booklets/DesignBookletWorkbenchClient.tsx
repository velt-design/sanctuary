"use client";

import { useMemo, useState } from "react";
import {
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  type DesignBookletContentCatalog,
  type DesignBookletContentPage,
  type DesignBookletDraft,
  type DesignBookletImagePlacement,
} from "@/lib/designBooklets/types";
import { TONI_DESIGN_BOOKLET_ASSETS } from "@/lib/designBooklets/defaults";
import {
  buildDesignBookletRenderModel,
  createDesignBookletDrawingPage,
  createDesignBookletImagePage,
  DESIGN_BOOKLET_MAX_CONTENT_PAGES,
  moveDesignBookletContentPage,
  renderableDesignBookletAssetSources,
} from "@/lib/designBooklets/pageModel";
import BookletPageComposer from "./BookletPageComposer";
import DesignBookletDrawingPdfPreview from "./DesignBookletDrawingPdfPreview";
import DesignBookletPages from "./DesignBookletPages";
import styles from "./designBooklets.module.css";
import { useDesignBookletPdfArtifact } from "./useDesignBookletPdfArtifact";
import {
  previewAssetFromSource,
  useProjectDesignBookletController,
} from "./useProjectDesignBookletController";

type Props = {
  content: DesignBookletContentCatalog;
  pdfEndpoint: string;
  projectId?: string;
  qaFixture?: boolean;
};

export default function DesignBookletWorkbenchClient({
  content,
  pdfEndpoint,
  projectId,
  qaFixture = false,
}: Props) {
  const {
    linkedProjectId,
    draft,
    setDraft,
    assets,
    setAssets,
    project,
    saveState,
    persistenceError,
    setPersistenceError,
    markAssetDisplayState,
    revokeAssetUrl,
    replaceAsset,
    copyAsset,
    flushSave,
  } = useProjectDesignBookletController(projectId);
  const [selectedPageKey, setSelectedPageKey] = useState("cover");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const pageModel = useMemo(
    () => buildDesignBookletRenderModel(draft),
    [draft],
  );
  const selectedPageIndex = Math.max(
    0,
    pageModel.findIndex((page) => page.key === selectedPageKey),
  );
  const selectedPage = pageModel[selectedPageIndex] ?? pageModel[0];
  const hasBlockingImageState = renderableDesignBookletAssetSources(draft).some(
    (source) => {
      const asset = assets[source.assetId];
      return asset?.state === "loading" || asset?.state === "error";
    },
  );
  const pdfArtifact = useDesignBookletPdfArtifact({
    draft,
    assets,
    linkedProjectId,
    pdfEndpoint,
    flushSave,
    autoPrepare: selectedPage.kind === "drawings",
    canPrepare:
      !hasBlockingImageState &&
      saveState !== "loading" &&
      saveState !== "uploading" &&
      saveState !== "error",
  });

  const selectionSummary = useMemo(() => {
    const roofForm = content.roofForms[draft.roofFormId];
    const material = content.materials[draft.materialId];
    return `${roofForm.shortName} / ${material.label}`;
  }, [content, draft.materialId, draft.roofFormId]);

  function updateAsset(assetId: string, file: File | undefined) {
    setDownloadError("");
    setPersistenceError("");
    void replaceAsset(assetId, file);
  }

  function addPage(kind: "image" | "drawings") {
    if (draft.contentPages.length >= DESIGN_BOOKLET_MAX_CONTENT_PAGES) {
      setDownloadError(
        `A booklet can contain up to ${DESIGN_BOOKLET_MAX_CONTENT_PAGES} content pages.`,
      );
      return;
    }

    const page =
      kind === "image"
        ? createDesignBookletImagePage(
            draft.contentPages,
            (() => {
              const imageCount = draft.contentPages.filter(
                (candidate) => candidate.kind === "image",
              ).length;
              const id = ["render-1", "render-2", "render-3"][
                imageCount % 3
              ] as "render-1" | "render-2" | "render-3";
              return linkedProjectId
                ? {
                    id,
                    alt: `Customer design image ${imageCount + 1}`,
                    useDefaultAsset: false,
                  }
                : { id, alt: TONI_DESIGN_BOOKLET_ASSETS[id].alt };
            })(),
          )
        : createDesignBookletDrawingPage(
            draft.contentPages,
            linkedProjectId
              ? {
                  id: "plan",
                  alt: "Customer drawing",
                  useDefaultAsset: false,
                }
              : {
                  id: "plan",
                  alt: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
                },
          );

    const pageSources =
      page.kind === "image"
        ? [page.image]
        : page.drawings.map((drawing) => drawing.image);
    setDraft((current) => ({
      ...current,
      contentPages: [...current.contentPages, page],
    }));
    setAssets((current) => ({
      ...current,
      ...Object.fromEntries(
        pageSources.map((source) => [
          source.assetId,
          previewAssetFromSource(source),
        ]),
      ),
    }));
    setSelectedPageKey(page.id);
    setStatusMessage(`${kind === "image" ? "Image" : "Drawing"} page added.`);
  }

  function movePage(pageId: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      contentPages: moveDesignBookletContentPage(
        current.contentPages,
        pageId,
        direction,
      ),
    }));
    setSelectedPageKey(pageId);
    setStatusMessage("Page order updated.");
  }

  function removePage(page: DesignBookletContentPage) {
    const pageIndex = draft.contentPages.findIndex(
      (candidate) => candidate.id === page.id,
    );
    const nextPages = draft.contentPages.filter(
      (candidate) => candidate.id !== page.id,
    );
    const nextSelection =
      nextPages[pageIndex]?.id ?? nextPages[pageIndex - 1]?.id ?? "review";
    const removedAssetIds =
      page.kind === "image"
        ? [page.image.assetId]
        : page.drawings.map((drawing) => drawing.image.assetId);
    for (const assetId of removedAssetIds) {
      revokeAssetUrl(assets[assetId]);
    }

    setDraft((current) => ({
      ...current,
      contentPages: current.contentPages.filter(
        (candidate) => candidate.id !== page.id,
      ),
    }));
    setAssets((current) => {
      const next = { ...current };
      for (const assetId of removedAssetIds) {
        delete next[assetId];
      }
      return next;
    });
    setSelectedPageKey(nextSelection);
    setStatusMessage("Page removed.");
  }

  function updatePage(page: DesignBookletContentPage) {
    setDraft((current) => ({
      ...current,
      contentPages: current.contentPages.map((candidate) =>
        candidate.id === page.id ? page : candidate,
      ),
    }));
  }

  function updateFixedImage(
    key: "cover" | "review",
    image: DesignBookletImagePlacement,
  ) {
    setDraft((current) =>
      key === "cover"
        ? { ...current, cover: image }
        : { ...current, reviewPage: { image } },
    );
  }

  function useAsCover(image: DesignBookletImagePlacement) {
    const coverAssetId = draft.cover.assetId;
    const updateCoverDraft = () =>
      setDraft((current) => ({
        ...current,
        cover: {
          ...image,
          assetId: coverAssetId,
          altText: image.altText,
        },
      }));
    const copied = copyAsset(image.assetId, coverAssetId);
    if (linkedProjectId) {
      void copied
        .then(() => {
          updateCoverDraft();
          setStatusMessage("Cover image updated.");
        })
        .catch(() => undefined);
    } else {
      updateCoverDraft();
      setStatusMessage("Cover image updated.");
    }
    setSelectedPageKey("cover");
  }

  async function downloadPdf() {
    setIsDownloading(true);
    setDownloadError("");
    try {
      await pdfArtifact.download();
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "The PDF could not be generated.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <main
      className={styles.workbench}
      data-design-booklet-workbench
      data-project-state={linkedProjectId ? saveState : undefined}
      data-qa-fixture={qaFixture ? "true" : undefined}
    >
      <header className={styles.siteHeader}>
        <a className={styles.siteBrand} href="#booklet-preview">
          <strong>SANCTUARY</strong>
          <span>DESIGN BOOKLETS</span>
        </a>
        <div className={styles.headerStatus}>
          <span>
            {linkedProjectId ? "Project booklet" : "Standalone booklet"}
          </span>
          <strong>
            {linkedProjectId
              ? saveState === "saved"
                ? "Saved to project"
                : saveState === "saving"
                  ? "Saving changes"
                  : saveState === "uploading"
                    ? "Uploading image"
                    : saveState === "loading"
                      ? "Loading project"
                      : saveState === "error"
                        ? "Save needs attention"
                        : "Project booklet"
              : "Preview only · not saved"}
          </strong>
        </div>
        <div className={styles.headerActions}>
          {linkedProjectId ? (
            <a
              className={styles.returnLink}
              href={
                project?.returnHref ??
                `/staff/projects/${encodeURIComponent(linkedProjectId)}`
              }
            >
              Return to {project?.name ?? "project"}
            </a>
          ) : null}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={downloadPdf}
            disabled={
              isDownloading ||
              hasBlockingImageState ||
              saveState === "loading" ||
              saveState === "uploading" ||
              (Boolean(linkedProjectId) && saveState === "error")
            }
          >
            {isDownloading
              ? "Preparing download..."
              : hasBlockingImageState
                ? "Preparing images..."
                : selectedPage.kind === "drawings" &&
                    pdfArtifact.state !== "ready"
                  ? "Preparing exact preview..."
                  : "Download PDF"}
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.controlRail} aria-label="Booklet controls">
          <details className={styles.bookletDetails} id="booklet-details">
            <summary>
              <span className={styles.detailsSummaryCopy}>
                <span className={styles.sectionEyebrow}>Booklet details</span>
                <strong>{draft.projectTitle}</strong>
                <span>{selectionSummary}</span>
              </span>
              <span className={styles.detailsToggle} aria-hidden="true">
                <span className={styles.detailsToggleClosed}>Edit</span>
                <span className={styles.detailsToggleOpen}>Close</span>
              </span>
            </summary>

            <div className={styles.detailsPanel}>
              <div className={styles.detailsGrid}>
                <label className={styles.field}>
                  <span>Customer name</span>
                  <input
                    required
                    value={draft.customerName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                    maxLength={80}
                  />
                </label>
                <label className={styles.field}>
                  <span>Booklet title</span>
                  <input
                    required
                    value={draft.projectTitle}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        projectTitle: event.target.value,
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label className={styles.field}>
                  <span>Roof form</span>
                  <select
                    value={draft.roofFormId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        roofFormId: event.target
                          .value as DesignBookletDraft["roofFormId"],
                      }))
                    }
                  >
                    {DESIGN_BOOKLET_ROOF_FORM_IDS.map((id) => (
                      <option key={id} value={id}>
                        {content.roofForms[id].name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Roofing choice</span>
                  <select
                    value={draft.materialId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        materialId: event.target
                          .value as DesignBookletDraft["materialId"],
                      }))
                    }
                  >
                    {DESIGN_BOOKLET_MATERIAL_IDS.map((id) => (
                      <option key={id} value={id}>
                        {content.materials[id].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className={styles.sourceNote}>
                Roof and material labels use governed marketing content.
              </p>
            </div>
          </details>

          <section className={styles.railSection} id="booklet-pages">
            <header className={styles.railSectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Booklet structure</p>
                <h2>Pages</h2>
              </div>
              <span>{String(pageModel.length).padStart(2, "0")}</span>
            </header>
            <BookletPageComposer
              draft={draft}
              selectedPageKey={selectedPageKey}
              assets={assets}
              onSelectPage={setSelectedPageKey}
              onAddPage={addPage}
              onMovePage={movePage}
              onRemovePage={removePage}
              onUpdatePage={updatePage}
              onUpdateFixedImage={updateFixedImage}
              onReplaceAsset={updateAsset}
              onUseAsCover={useAsCover}
              onAssetDisplayState={markAssetDisplayState}
            />
          </section>
        </aside>

        <section
          className={styles.previewWorkspace}
          id="booklet-preview"
          aria-label="Landscape A4 booklet preview"
        >
          <header className={styles.previewToolbar}>
            <div>
              <p className={styles.sectionEyebrow}>Page preview</p>
              <h2>{selectedPage.label}</h2>
            </div>
            <div className={styles.previewControls}>
              <span>
                {String(selectedPage.pageNumber).padStart(2, "0")} /{" "}
                {String(pageModel.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedPageKey(pageModel[selectedPageIndex - 1].key)
                }
                disabled={selectedPageIndex === 0}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedPageKey(pageModel[selectedPageIndex + 1].key)
                }
                disabled={selectedPageIndex === pageModel.length - 1}
              >
                Next
              </button>
            </div>
          </header>

          <div className={styles.previewCanvas}>
            <div className={styles.pageStage}>
              <DesignBookletPages
                selectedPageKey={selectedPageKey}
                draft={draft}
                content={content}
                assets={assets}
                drawingPagePreview={
                  <DesignBookletDrawingPdfPreview
                    bytes={pdfArtifact.bytes}
                    pageNumber={selectedPage.pageNumber}
                    pageCount={selectedPage.pageCount}
                    state={pdfArtifact.state}
                    error={pdfArtifact.error}
                    onRetry={() => {
                      void pdfArtifact.prepare().catch(() => undefined);
                    }}
                  />
                }
                onAssetDisplayState={markAssetDisplayState}
              />
            </div>
          </div>
        </section>
      </div>

      <p className={styles.srStatus} aria-live="polite">
        {statusMessage}
      </p>
      {persistenceError || downloadError ? (
        <p className={styles.errorMessage} role="alert">
          {persistenceError || downloadError}
        </p>
      ) : null}
    </main>
  );
}
