"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESIGN_BOOKLET_MATERIAL_IDS,
  DESIGN_BOOKLET_RENDER_IDS,
  DESIGN_BOOKLET_ROOF_FORM_IDS,
  type DesignBookletContentCatalog,
  type DesignBookletDraft,
  type DesignBookletRenderId,
} from "@/lib/designBooklets/types";
import {
  DESIGN_BOOKLET_PAGE_COUNT,
  TONI_DESIGN_BOOKLET_ASSETS,
  TONI_DESIGN_BOOKLET_DRAFT,
} from "@/lib/designBooklets/defaults";
import DesignBookletPages, {
  type DesignBookletPreviewAsset,
} from "./DesignBookletPages";
import styles from "./designBooklets.module.css";

type AssetMap = Record<
  DesignBookletRenderId | "plan",
  DesignBookletPreviewAsset
>;

type Props = {
  content: DesignBookletContentCatalog;
  pdfEndpoint: string;
  qaFixture?: boolean;
};

const PAGE_LABELS = [
  "Cover",
  "Overview",
  "Design view",
  "Plan",
  "Roof form",
  "Roofing",
] as const;

function initialAssets(): AssetMap {
  return Object.fromEntries(
    Object.entries(TONI_DESIGN_BOOKLET_ASSETS).map(([id, asset]) => [
      id,
      { id, src: asset.src, alt: asset.alt, label: asset.label },
    ]),
  ) as AssetMap;
}

function moveRender(
  order: DesignBookletRenderId[],
  id: DesignBookletRenderId,
  direction: -1 | 1,
): DesignBookletRenderId[] {
  const currentIndex = order.indexOf(id);
  const nextIndex = currentIndex + direction;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= order.length) {
    return order;
  }
  const next = [...order];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
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
  const [draft, setDraft] = useState<DesignBookletDraft>({
    ...TONI_DESIGN_BOOKLET_DRAFT,
    renderOrder: [...TONI_DESIGN_BOOKLET_DRAFT.renderOrder],
  });
  const [assets, setAssets] = useState<AssetMap>(initialAssets);
  const [pageNumber, setPageNumber] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const blobUrlsRef = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const url of blobUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const selectionSummary = useMemo(() => {
    const roofForm = content.roofForms[draft.roofFormId];
    const material = content.materials[draft.materialId];
    return `${roofForm.shortName} / ${material.label}`;
  }, [content, draft.materialId, draft.roofFormId]);

  function updateAsset(
    assetId: DesignBookletRenderId | "plan",
    file: File | undefined,
  ) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setDownloadError("Choose a PNG or JPEG image.");
      return;
    }
    setDownloadError("");
    setAssets((current) => {
      const existing = current[assetId];
      if (existing.file && existing.src.startsWith("blob:")) {
        URL.revokeObjectURL(existing.src);
        blobUrlsRef.current.delete(existing.src);
      }
      const src = URL.createObjectURL(file);
      blobUrlsRef.current.add(src);
      return {
        ...current,
        [assetId]: { ...existing, src, file },
      };
    });
  }

  function changeRenderOrder(id: DesignBookletRenderId, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      renderOrder: moveRender(current.renderOrder, id, direction),
    }));
  }

  function makeCover(id: DesignBookletRenderId) {
    setDraft((current) => ({
      ...current,
      renderOrder: [
        id,
        ...current.renderOrder.filter((candidate) => candidate !== id),
      ],
    }));
    setPageNumber(1);
  }

  async function downloadPdf() {
    setIsDownloading(true);
    setDownloadError("");
    try {
      const formData = new FormData();
      formData.set("draft", JSON.stringify(draft));
      for (const [id, asset] of Object.entries(assets)) {
        if (asset.file) formData.set(`asset:${id}`, asset.file);
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
        <nav aria-label="Workbench sections">
          <a href="#booklet-preview">Preview</a>
          <a href="#booklet-details">Details</a>
          <a href="#booklet-images">Images</a>
        </nav>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={downloadPdf}
          disabled={isDownloading}
        >
          {isDownloading ? "Building PDF..." : "Download PDF"}
        </button>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.sectionEyebrow}>Design booklet workbench</p>
          <h1>Build the booklet as a customer journey.</h1>
        </div>
        <div className={styles.introAside}>
          <p>
            Shape the sequence, choose the views, and review the landscape
            booklet exactly as a customer document.
          </p>
          <span>{selectionSummary}</span>
          <span>{DESIGN_BOOKLET_PAGE_COUNT} landscape pages</span>
        </div>
      </section>

      <section
        className={styles.previewSection}
        id="booklet-preview"
        aria-label="Landscape A4 booklet preview"
      >
        <header className={styles.sectionHeader}>
          <div className={styles.sectionNumber}>01</div>
          <div>
            <p className={styles.sectionEyebrow}>Customer preview</p>
            <h2>Move through the story.</h2>
          </div>
          <div className={styles.previewControls}>
            <span>
              {String(pageNumber).padStart(2, "0")} /{" "}
              {String(DESIGN_BOOKLET_PAGE_COUNT).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((current) => current - 1)}
              disabled={pageNumber === 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPageNumber((current) => current + 1)}
              disabled={pageNumber === DESIGN_BOOKLET_PAGE_COUNT}
            >
              Next
            </button>
          </div>
        </header>

        <nav className={styles.pageRail} aria-label="Booklet pages">
          {PAGE_LABELS.map((label, index) => {
            const number = index + 1;
            return (
              <button
                type="button"
                key={number}
                aria-current={pageNumber === number ? "page" : undefined}
                onClick={() => setPageNumber(number)}
              >
                <span>{String(number).padStart(2, "0")}</span>
                {label}
              </button>
            );
          })}
        </nav>

        <div className={styles.pageStage}>
          <DesignBookletPages
            pageNumber={pageNumber}
            draft={draft}
            content={content}
            assets={assets}
          />
        </div>
      </section>

      <section
        className={styles.editorSection}
        id="booklet-details"
        aria-label="Booklet controls"
      >
        <header className={styles.sectionHeader}>
          <div className={styles.sectionNumber}>02</div>
          <div>
            <p className={styles.sectionEyebrow}>Booklet details</p>
            <h2>Set the story.</h2>
          </div>
          <p>These changes stay in this browser until the PDF is downloaded.</p>
        </header>

        <div className={styles.detailsGrid}>
          <label className={styles.field}>
            <span>Customer name</span>
            <input
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
          Roof-form and material wording is read directly from the governed
          marketing content.
        </p>
      </section>

      <section className={styles.imagesSection} id="booklet-images">
        <header className={styles.sectionHeader}>
          <div className={styles.sectionNumber}>03</div>
          <div>
            <p className={styles.sectionEyebrow}>Image sequence</p>
            <h2>Choose the views.</h2>
          </div>
          <p>
            The first render becomes the cover. Move the others to change the
            booklet sequence.
          </p>
        </header>

        <div className={styles.assetGrid}>
          {draft.renderOrder.map((id, index) => {
            const asset = assets[id];
            return (
              <article
                className={styles.assetCard}
                key={id}
                data-render-slot={id}
                data-cover-image={index === 0 ? "true" : undefined}
              >
                <div className={styles.assetImage}>
                  <img src={asset.src} alt="" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className={styles.assetCardBody}>
                  <div>
                    <span>{index === 0 ? "Cover image" : "Design view"}</span>
                    <strong>{asset.label}</strong>
                  </div>
                  <div className={styles.assetActions}>
                    <label className={styles.fileButton}>
                      Replace
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(event) =>
                          updateAsset(id, event.target.files?.[0])
                        }
                      />
                    </label>
                    {index > 0 ? (
                      <button type="button" onClick={() => makeCover(id)}>
                        Make cover
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => changeRenderOrder(id, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${asset.label} earlier`}
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      onClick={() => changeRenderOrder(id, 1)}
                      disabled={index === draft.renderOrder.length - 1}
                      aria-label={`Move ${asset.label} later`}
                    >
                      Later
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          <article className={`${styles.assetCard} ${styles.planAssetCard}`}>
            <div className={styles.assetImage}>
              <img src={assets.plan.src} alt="" />
              <span>04</span>
            </div>
            <div className={styles.assetCardBody}>
              <div>
                <span>Plan</span>
                <strong>{assets.plan.label}</strong>
              </div>
              <div className={styles.assetActions}>
                <label className={styles.fileButton}>
                  Replace plan
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(event) =>
                      updateAsset("plan", event.target.files?.[0])
                    }
                  />
                </label>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.downloadSection}>
        <div>
          <p className={styles.sectionEyebrow}>Ready to review</p>
          <h2>Take the landscape booklet with you.</h2>
          <p>Preview and download only. Nothing is saved or sent.</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={downloadPdf}
          disabled={isDownloading}
        >
          {isDownloading ? "Building PDF..." : "Download landscape PDF"}
        </button>
      </section>

      {downloadError ? (
        <p className={styles.errorMessage} role="alert">
          {downloadError}
        </p>
      ) : null}
    </main>
  );
}
