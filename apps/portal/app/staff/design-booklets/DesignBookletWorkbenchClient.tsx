"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  type DesignBookletAssetSource,
  type DesignBookletContentCatalog,
  type DesignBookletContentPage,
  type DesignBookletDraft,
  type DesignBookletImagePlacement,
} from "@/lib/designBooklets/types";
import {
  TONI_DESIGN_BOOKLET_ASSETS,
  createToniDesignBookletDraft,
} from "@/lib/designBooklets/defaults";
import {
  allDesignBookletAssetSources,
  buildDesignBookletRenderModel,
  createDesignBookletDrawingPage,
  createDesignBookletImagePage,
  DESIGN_BOOKLET_MAX_IMAGE_BYTES,
  DESIGN_BOOKLET_MAX_CONTENT_PAGES,
  moveDesignBookletContentPage,
  renderableDesignBookletAssetSources,
} from "@/lib/designBooklets/pageModel";
import BookletPageComposer from "./BookletPageComposer";
import DesignBookletPages, {
  type DesignBookletPreviewAsset,
} from "./DesignBookletPages";
import styles from "./designBooklets.module.css";

type AssetMap = Record<string, DesignBookletPreviewAsset>;

type Props = {
  content: DesignBookletContentCatalog;
  pdfEndpoint: string;
  qaFixture?: boolean;
};

function previewAssetFromSource(
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

function initialAssets(draft: DesignBookletDraft): AssetMap {
  return Object.fromEntries(
    allDesignBookletAssetSources(draft).map((source) => [
      source.assetId,
      previewAssetFromSource(source),
    ]),
  );
}

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

export default function DesignBookletWorkbenchClient({
  content,
  pdfEndpoint,
  qaFixture = false,
}: Props) {
  const [draft, setDraft] = useState(createToniDesignBookletDraft);
  const [assets, setAssets] = useState<AssetMap>(() =>
    initialAssets(createToniDesignBookletDraft()),
  );
  const [selectedPageKey, setSelectedPageKey] = useState("cover");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const blobUrlsRef = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const pageModel = useMemo(
    () => buildDesignBookletRenderModel(draft),
    [draft],
  );
  const selectedPageIndex = Math.max(
    0,
    pageModel.findIndex((page) => page.key === selectedPageKey),
  );
  const selectedPage = pageModel[selectedPageIndex] ?? pageModel[0];

  const selectionSummary = useMemo(() => {
    const roofForm = content.roofForms[draft.roofFormId];
    const material = content.materials[draft.materialId];
    return `${roofForm.shortName} / ${material.label}`;
  }, [content, draft.materialId, draft.roofFormId]);

  function revokeAssetUrl(asset: DesignBookletPreviewAsset | undefined) {
    if (!asset?.src.startsWith("blob:")) return;
    URL.revokeObjectURL(asset.src);
    blobUrlsRef.current.delete(asset.src);
  }

  function updateAsset(assetId: string, file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setDownloadError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > DESIGN_BOOKLET_MAX_IMAGE_BYTES) {
      setDownloadError("Choose an image that is 15 MB or smaller.");
      return;
    }
    setDownloadError("");
    const existing = assets[assetId];
    if (!existing) return;
    const src = URL.createObjectURL(file);
    blobUrlsRef.current.add(src);
    revokeAssetUrl(existing);
    setAssets((current) => {
      const currentAsset = current[assetId];
      if (!currentAsset) return current;
      return {
        ...current,
        [assetId]: {
          ...currentAsset,
          src,
          file,
          label: file.name,
        },
      };
    });
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
              return { id, alt: TONI_DESIGN_BOOKLET_ASSETS[id].alt };
            })(),
          )
        : createDesignBookletDrawingPage(draft.contentPages, {
            id: "plan",
            alt: TONI_DESIGN_BOOKLET_ASSETS.plan.alt,
          });

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
    const sourceAsset = assets[image.assetId];
    if (!sourceAsset) return;
    const coverSrc = sourceAsset.file
      ? URL.createObjectURL(sourceAsset.file)
      : sourceAsset.src;
    if (sourceAsset.file) blobUrlsRef.current.add(coverSrc);
    revokeAssetUrl(assets[coverAssetId]);
    setAssets((current) => ({
      ...current,
      [coverAssetId]: {
        ...sourceAsset,
        id: coverAssetId,
        src: coverSrc,
      },
    }));
    setDraft((current) => ({
      ...current,
      cover: {
        ...image,
        assetId: coverAssetId,
        altText: image.altText,
      },
    }));
    setSelectedPageKey("cover");
    setStatusMessage("Cover image updated.");
  }

  async function downloadPdf() {
    setIsDownloading(true);
    setDownloadError("");
    try {
      const formData = new FormData();
      formData.set("draft", JSON.stringify(draft));
      for (const source of renderableDesignBookletAssetSources(draft)) {
        const asset = assets[source.assetId];
        if (asset?.file) formData.set(`asset:${source.assetId}`, asset.file);
      }
      const response = await fetch(pdfEndpoint, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "The PDF could not be generated.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromResponse(response, draft.customerName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
      data-qa-fixture={qaFixture ? "true" : undefined}
    >
      <header className={styles.siteHeader}>
        <a className={styles.siteBrand} href="#booklet-preview">
          <strong>SANCTUARY</strong>
          <span>DESIGN BOOKLETS</span>
        </a>
        <div className={styles.headerStatus}>
          <span>Customer preview</span>
          <strong>
            {selectedPage.label} /{" "}
            {String(selectedPage.pageNumber).padStart(2, "0")} of{" "}
            {String(pageModel.length).padStart(2, "0")}
          </strong>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={downloadPdf}
          disabled={isDownloading}
        >
          {isDownloading ? "Building PDF..." : "Download PDF"}
        </button>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.controlRail} aria-label="Booklet controls">
          <div className={styles.railIntroduction}>
            <p className={styles.sectionEyebrow}>Design booklet workbench</p>
            <h1>Shape the customer document.</h1>
            <div className={styles.railSummary}>
              <span>{selectionSummary}</span>
              <span>{pageModel.length} landscape pages</span>
            </div>
          </div>

          <section className={styles.railSection} id="booklet-details">
            <header className={styles.railSectionHeader}>
              <span>01</span>
              <div>
                <p className={styles.sectionEyebrow}>Booklet details</p>
                <h2>Cover story</h2>
              </div>
            </header>

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
              Labels come from governed marketing content. No product claims
              are added.
            </p>
          </section>

          <section className={styles.railSection} id="booklet-pages">
            <header className={styles.railSectionHeader}>
              <span>02</span>
              <div>
                <p className={styles.sectionEyebrow}>Booklet pages</p>
                <h2>Pages and content</h2>
              </div>
            </header>
            <p className={styles.railSectionCopy}>
              Select a page to edit it. Cover and review stay fixed.
            </p>
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
            />
          </section>

          <footer className={styles.railFooter}>
            <span>Preview and download only</span>
            <p>Nothing is saved or sent.</p>
          </footer>
        </aside>

        <section
          className={styles.previewWorkspace}
          id="booklet-preview"
          aria-label="Landscape A4 booklet preview"
        >
          <header className={styles.previewToolbar}>
            <div>
              <p className={styles.sectionEyebrow}>Customer preview</p>
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
              />
            </div>
          </div>
        </section>
      </div>

      <p className={styles.srStatus} aria-live="polite">
        {statusMessage}
      </p>
      {downloadError ? (
        <p className={styles.errorMessage} role="alert">
          {downloadError}
        </p>
      ) : null}
    </main>
  );
}
