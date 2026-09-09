import { useEffect, useRef, useState } from "react";
import {
  DESIGN_BOOKLET_CONTENT_LAYOUT_IDS,
  DESIGN_BOOKLET_CONTENT_VARIANT_IDS,
  DESIGN_BOOKLET_DRAWING_LAYOUT_IDS,
  DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS,
  DESIGN_BOOKLET_FOCAL_POINT_IDS,
  type DesignBookletContentImage,
  type DesignBookletContentLayoutId,
  type DesignBookletContentPage,
  type DesignBookletDraft,
  type DesignBookletDrawingItem,
  type DesignBookletDrawingPage,
  type DesignBookletImagePlacement,
  type DesignBookletImagePage,
} from "@/lib/designBooklets/types";
import {
  DESIGN_BOOKLET_CONTENT_LAYOUTS,
  visibleDesignBookletContentImages,
} from "@/lib/designBooklets/contentLayouts";
import {
  DESIGN_BOOKLET_CONTENT_VARIANTS,
  designBookletContentTextWarnings,
  resolveDesignBookletContentLayout,
} from "@/lib/designBooklets/contentPresentation";
import { DESIGN_BOOKLET_BASE_PAGE_SIZE } from "@/lib/designBooklets/paperGeometry";
import {
  buildDesignBookletRenderModel,
  DESIGN_BOOKLET_DRAWING_LAYOUTS,
  DESIGN_BOOKLET_FOCAL_POINTS,
  DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_BODY_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_CAPTION_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_EYEBROW_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_HEADLINE_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_SECTION_BODY_LENGTH,
  DESIGN_BOOKLET_MAX_CONTENT_SECTION_HEADING_LENGTH,
  moveDesignBookletDrawing,
  normalizeDesignBookletSheetTitle,
  visibleDesignBookletDrawings,
} from "@/lib/designBooklets/pageModel";
import DesignBookletPreviewImage from "./DesignBookletPreviewImage";
import BookletBulletTextArea from "./BookletBulletTextArea";
import ContentTypographyControls from "./ContentTypographyControls";
import type {
  DesignBookletAssetDisplayHandler,
  DesignBookletPreviewAsset,
} from "./previewAssets";
import styles from "./designBooklets.module.css";

type Props = {
  draft: DesignBookletDraft;
  selectedPageKey: string;
  assets: Record<string, DesignBookletPreviewAsset>;
  onSelectPage: (key: string) => void;
  onAddPage: (kind: DesignBookletContentLayoutId | "drawings") => void;
  onMovePage: (pageId: string, direction: -1 | 1) => void;
  onRemovePage: (page: DesignBookletContentPage) => void;
  onUpdatePage: (page: DesignBookletContentPage) => void;
  onUpdateFixedImage: (
    key: "cover" | "review",
    image: DesignBookletImagePlacement,
  ) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onReplaceDrawingPdf: (drawingId: string, file: File | undefined) => void;
  onSelectDrawingPdfPage: (drawingId: string, pageNumber: number) => void;
  onUseAsCover: (image: DesignBookletImagePlacement) => void;
  onAssetDisplayState: DesignBookletAssetDisplayHandler;
};

function FocalPointControl({
  value,
  onChange,
}: {
  value: DesignBookletImagePlacement["focalPoint"];
  onChange: (value: DesignBookletImagePlacement["focalPoint"]) => void;
}) {
  return (
    <fieldset className={styles.focalFieldset}>
      <legend>Image focus</legend>
      <div className={styles.focalGrid}>
        {DESIGN_BOOKLET_FOCAL_POINT_IDS.map((id) => (
          <button
            type="button"
            key={id}
            aria-label={DESIGN_BOOKLET_FOCAL_POINTS[id].label}
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ImageEditor({
  eyebrow,
  image,
  asset,
  replaceLabel,
  onChange,
  onReplaceAsset,
  onUseAsCover,
  onAssetDisplayState,
  caption,
  onCaptionChange,
}: {
  eyebrow: string;
  image: DesignBookletImagePlacement;
  asset: DesignBookletPreviewAsset;
  replaceLabel: string;
  onChange: (image: DesignBookletImagePlacement) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onUseAsCover?: () => void;
  onAssetDisplayState: DesignBookletAssetDisplayHandler;
  caption?: string;
  onCaptionChange?: (value: string) => void;
}) {
  return (
    <div className={styles.imageEditor}>
      <div className={styles.editorImagePreview}>
        <DesignBookletPreviewImage
          asset={asset}
          alt=""
          tone="paper"
          showEmptyLabel
          onDisplayState={onAssetDisplayState}
        />
        <span>{eyebrow}</span>
      </div>
      <div className={styles.imageEditorFields}>
        <div className={styles.inlineActions}>
          <label className={styles.fileButton}>
            {replaceLabel}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) =>
                onReplaceAsset(image.assetId, event.target.files?.[0])
              }
            />
          </label>
          {onUseAsCover ? (
            <button
              type="button"
              onClick={onUseAsCover}
              disabled={asset.state !== "ready"}
            >
              Use as cover
            </button>
          ) : null}
        </div>
        <label className={styles.field}>
          <span>Image description</span>
          <input
            value={image.altText}
            maxLength={240}
            onChange={(event) =>
              onChange({ ...image, altText: event.target.value })
            }
          />
          <small>Preview accessibility only — not embedded in the PDF.</small>
        </label>
        {onCaptionChange ? (
          <label className={styles.field}>
            <span>Visible caption</span>
            <input
              value={caption ?? ""}
              maxLength={DESIGN_BOOKLET_MAX_CONTENT_CAPTION_LENGTH}
              placeholder="Optional short caption"
              onChange={(event) => onCaptionChange(event.target.value)}
            />
          </label>
        ) : null}
        <FocalPointControl
          value={image.focalPoint}
          onChange={(focalPoint) => onChange({ ...image, focalPoint })}
        />
      </div>
    </div>
  );
}

function ContentLayoutPreview({
  page,
  layoutId,
  variant = page.variant,
}: {
  page: DesignBookletImagePage;
  layoutId: DesignBookletContentLayoutId;
  variant?: DesignBookletImagePage["variant"];
}) {
  const layout = resolveDesignBookletContentLayout({
    ...page,
    layout: layoutId,
    variant,
  });
  return (
    <span className={styles.layoutPreview} aria-hidden="true">
      {layout.imageFrames.map((frame, index) => (
        <span
          key={index}
          style={{
            left: `${(frame.x / DESIGN_BOOKLET_BASE_PAGE_SIZE.width) * 100}%`,
            top: `${(frame.top / DESIGN_BOOKLET_BASE_PAGE_SIZE.height) * 100}%`,
            width: `${(frame.width / DESIGN_BOOKLET_BASE_PAGE_SIZE.width) * 100}%`,
            height: `${(frame.height / DESIGN_BOOKLET_BASE_PAGE_SIZE.height) * 100}%`,
          }}
        />
      ))}
      {layout.textFrame ? (
        <span
          className={styles.layoutTextPreview}
          style={{
            left: `${(layout.textFrame.x / DESIGN_BOOKLET_BASE_PAGE_SIZE.width) * 100}%`,
            top: `${(layout.textFrame.top / DESIGN_BOOKLET_BASE_PAGE_SIZE.height) * 100}%`,
            width: `${(layout.textFrame.width / DESIGN_BOOKLET_BASE_PAGE_SIZE.width) * 100}%`,
            height: `${(layout.textFrame.height / DESIGN_BOOKLET_BASE_PAGE_SIZE.height) * 100}%`,
          }}
        />
      ) : null}
    </span>
  );
}

function LayoutPreview({
  layoutId,
}: {
  layoutId: DesignBookletDrawingPage["layout"];
}) {
  return (
    <span className={styles.layoutPreview} aria-hidden="true">
      {DESIGN_BOOKLET_DRAWING_LAYOUTS[layoutId].frames.map((frame, index) => (
        <span
          key={index}
          style={{
            left: `${frame.x * 100}%`,
            top: `${frame.y * 100}%`,
            width: `${frame.width * 100}%`,
            height: `${frame.height * 100}%`,
          }}
        />
      ))}
    </span>
  );
}

function DrawingSlotEditor({
  drawing,
  asset,
  index,
  slotCount,
  onChange,
  onMove,
  onReplaceAsset,
  onSelectPdfPage,
  onAssetDisplayState,
}: {
  drawing: DesignBookletDrawingItem;
  asset: DesignBookletPreviewAsset;
  index: number;
  slotCount: number;
  onChange: (drawing: DesignBookletDrawingItem) => void;
  onMove: (direction: -1 | 1) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onSelectPdfPage: (drawingId: string, pageNumber: number) => void;
  onAssetDisplayState: DesignBookletAssetDisplayHandler;
}) {
  const titleValue =
    drawing.title.kind === "custom" ? "custom" : drawing.title.value;
  return (
    <article
      className={styles.drawingSlotEditor}
      data-drawing-editor-slot={index + 1}
    >
      <div className={styles.drawingSlotImage}>
        <DesignBookletPreviewImage
          asset={asset}
          alt=""
          tone="paper"
          showEmptyLabel
          onDisplayState={onAssetDisplayState}
        />
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className={styles.drawingSlotFields}>
        <label className={styles.field}>
          <span>Drawing title</span>
          <select
            value={titleValue}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                ...drawing,
                title:
                  value === "custom"
                    ? { kind: "custom", value: "Drawing" }
                    : {
                        kind: "preset",
                        value:
                          value as (typeof DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS)[number],
                      },
              });
            }}
          >
            <option value="plan">Plan</option>
            <option value="section">Section</option>
            <option value="elevation">Elevation</option>
            <option value="isometric">Isometric</option>
            <option value="custom">Custom title</option>
          </select>
        </label>
        {drawing.title.kind === "custom" ? (
          <label className={styles.field}>
            <span>Custom title</span>
            <input
              value={drawing.title.value}
              maxLength={80}
              autoFocus
              onChange={(event) =>
                onChange({
                  ...drawing,
                  title: { kind: "custom", value: event.target.value },
                })
              }
            />
          </label>
        ) : null}
        <label className={styles.field}>
          <span>Drawing description</span>
          <input
            value={drawing.image.altText}
            maxLength={240}
            onChange={(event) =>
              onChange({
                ...drawing,
                image: { ...drawing.image, altText: event.target.value },
              })
            }
          />
        </label>
        {drawing.pdf ? (
          <label className={styles.field}>
            <span>PDF page</span>
            <select
              value={drawing.pdf.pageNumber}
              onChange={(event) =>
                onSelectPdfPage(drawing.id, Number(event.target.value))
              }
            >
              {Array.from({ length: drawing.pdf.pageCount }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Page {index + 1} of {drawing.pdf?.pageCount}
                </option>
              ))}
            </select>
            <small>{drawing.pdf.fileName}</small>
          </label>
        ) : null}
        <div className={styles.inlineActions}>
          <label className={styles.fileButton}>
            Replace drawing
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) =>
                onReplaceAsset(drawing.id, event.target.files?.[0])
              }
            />
          </label>
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move drawing ${index + 1} earlier`}
          >
            Earlier
          </button>
          <button
            type="button"
            disabled={index === slotCount - 1}
            onClick={() => onMove(1)}
            aria-label={`Move drawing ${index + 1} later`}
          >
            Later
          </button>
        </div>
      </div>
    </article>
  );
}

function ContentPageEditor({
  page,
  assets,
  onChange,
  onReplaceAsset,
  onUseAsCover,
  onAssetDisplayState,
}: {
  page: DesignBookletImagePage;
  assets: Record<string, DesignBookletPreviewAsset>;
  onChange: (page: DesignBookletImagePage) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onUseAsCover: (image: DesignBookletImagePlacement) => void;
  onAssetDisplayState: DesignBookletAssetDisplayHandler;
}) {
  const layout = DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout];
  const visibleImages = visibleDesignBookletContentImages(page);
  const warnings = designBookletContentTextWarnings(page);

  function updateImage(index: number, image: DesignBookletContentImage) {
    const images = page.images.map((candidate, candidateIndex) =>
      candidateIndex === index ? image : candidate,
    ) as DesignBookletImagePage["images"];
    onChange({ ...page, images });
  }

  return (
    <div className={styles.contentPageEditor}>
      <fieldset className={styles.layoutFieldset}>
        <legend>Page template</legend>
        <div className={styles.layoutOptions}>
          {DESIGN_BOOKLET_CONTENT_LAYOUT_IDS.map((layoutId) => {
            const definition = DESIGN_BOOKLET_CONTENT_LAYOUTS[layoutId];
            return (
              <button
                type="button"
                key={layoutId}
                aria-pressed={page.layout === layoutId}
                onClick={() => onChange({ ...page, layout: layoutId })}
              >
                <ContentLayoutPreview page={page} layoutId={layoutId} />
                <strong>{definition.label}</strong>
                <span>{definition.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.layoutFieldset}>
        <legend>Page framing</legend>
        <div className={styles.variantOptions}>
          {DESIGN_BOOKLET_CONTENT_VARIANT_IDS.map((variantId) => {
            const definition = DESIGN_BOOKLET_CONTENT_VARIANTS[variantId];
            return (
              <button
                type="button"
                key={variantId}
                aria-pressed={page.variant === variantId}
                onClick={() => onChange({ ...page, variant: variantId })}
              >
                <ContentLayoutPreview
                  page={page}
                  layoutId={page.layout}
                  variant={variantId}
                />
                <span>
                  <strong>{definition.label}</strong>
                  <small>{definition.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {layout.textFrame ? (
        <section className={styles.copyEditor}>
          <div className={styles.copyEditorHeading}>
            <strong>Page copy</strong>
            <span>Text remains attached when you change templates.</span>
          </div>
          <label className={styles.field}>
            <span>Eyebrow</span>
            <input
              value={page.content.eyebrow}
              maxLength={DESIGN_BOOKLET_MAX_CONTENT_EYEBROW_LENGTH}
              placeholder="Design direction"
              onChange={(event) =>
                onChange({
                  ...page,
                  content: { ...page.content, eyebrow: event.target.value },
                })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Headline</span>
            <textarea
              value={page.content.headline}
              maxLength={DESIGN_BOOKLET_MAX_CONTENT_HEADLINE_LENGTH}
              rows={2}
              placeholder="Add a concise page headline"
              onChange={(event) =>
                onChange({
                  ...page,
                  content: { ...page.content, headline: event.target.value },
                })
              }
            />
          </label>
          <ContentTypographyControls
            content={page.content}
            onChange={(content) => onChange({ ...page, content })}
          />
          {page.layout !== "information-material-split" ? (
            <BookletBulletTextArea
              id={`${page.id}-body-copy`}
              label="Body copy"
              value={page.content.body}
              maxLength={DESIGN_BOOKLET_MAX_CONTENT_BODY_LENGTH}
              rows={5}
              placeholder="Add a short explanation of this part of the concept."
              onChange={(body) =>
                onChange({
                  ...page,
                  content: { ...page.content, body },
                })
              }
            />
          ) : (
            <div className={styles.materialSectionEditors}>
              {page.content.sections.map((section, index) => (
                <section key={index}>
                  <strong>Material section {index + 1}</strong>
                  <label className={styles.field}>
                    <span>Heading</span>
                    <input
                      value={section.heading}
                      maxLength={
                        DESIGN_BOOKLET_MAX_CONTENT_SECTION_HEADING_LENGTH
                      }
                      onChange={(event) => {
                        const sections = page.content.sections.map(
                          (candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, heading: event.target.value }
                              : candidate,
                        ) as DesignBookletImagePage["content"]["sections"];
                        onChange({
                          ...page,
                          content: { ...page.content, sections },
                        });
                      }}
                    />
                  </label>
                  <BookletBulletTextArea
                    id={`${page.id}-section-${index + 1}-copy`}
                    label="Copy"
                    value={section.body}
                    maxLength={DESIGN_BOOKLET_MAX_CONTENT_SECTION_BODY_LENGTH}
                    rows={3}
                    onChange={(body) => {
                      const sections = page.content.sections.map(
                        (candidate, candidateIndex) =>
                          candidateIndex === index
                            ? { ...candidate, body }
                            : candidate,
                      ) as DesignBookletImagePage["content"]["sections"];
                      onChange({
                        ...page,
                        content: { ...page.content, sections },
                      });
                    }}
                  />
                </section>
              ))}
            </div>
          )}
          {warnings.length ? (
            <div className={styles.overflowWarning} role="status">
              <strong>Check the page preview</strong>
              {warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <p className={styles.retainedCopyNote}>
          This visual template hides page copy. Your text remains saved if you
          switch back to a story or information template.
        </p>
      )}

      <div className={styles.contentImageEditors}>
        {visibleImages.map((image, index) => (
          <ImageEditor
            key={image.assetId}
            eyebrow={`Image ${index + 1}`}
            image={image}
            asset={assets[image.assetId]}
            replaceLabel="Replace image"
            caption={image.caption}
            onCaptionChange={(caption) =>
              updateImage(index, { ...image, caption })
            }
            onChange={(nextImage) =>
              updateImage(index, { ...image, ...nextImage })
            }
            onReplaceAsset={onReplaceAsset}
            onUseAsCover={() =>
              onUseAsCover({
                assetId: image.assetId,
                defaultAssetId: image.defaultAssetId,
                useDefaultAsset: image.useDefaultAsset,
                altText: image.altText,
                focalPoint: image.focalPoint,
              })
            }
            onAssetDisplayState={onAssetDisplayState}
          />
        ))}
      </div>
    </div>
  );
}

function DrawingPageEditor({
  page,
  assets,
  onChange,
  onReplaceAsset,
  onSelectDrawingPdfPage,
  onAssetDisplayState,
}: {
  page: DesignBookletDrawingPage;
  assets: Record<string, DesignBookletPreviewAsset>;
  onChange: (page: DesignBookletDrawingPage) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onSelectDrawingPdfPage: (drawingId: string, pageNumber: number) => void;
  onAssetDisplayState: DesignBookletAssetDisplayHandler;
}) {
  const visibleDrawings = visibleDesignBookletDrawings(page);
  const slotCount = visibleDrawings.length;

  function updateDrawing(nextDrawing: DesignBookletDrawingItem) {
    const drawings = page.drawings.map((drawing) =>
      drawing.id === nextDrawing.id ? nextDrawing : drawing,
    ) as DesignBookletDrawingPage["drawings"];
    onChange({ ...page, drawings });
  }

  return (
    <div className={styles.drawingPageEditor}>
      <div className={styles.sheetDetailsEditor}>
        <label className={styles.field}>
          <span>Sheet title</span>
          <input
            value={page.pageTitle}
            maxLength={DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH}
            onChange={(event) =>
              onChange({
                ...page,
                pageTitle: normalizeDesignBookletSheetTitle(event.target.value),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Revision</span>
          <input
            value={page.revision}
            maxLength={DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH}
            onChange={(event) =>
              onChange({ ...page, revision: event.target.value })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Issue date</span>
          <input
            type="date"
            value={page.issueDate}
            onChange={(event) =>
              onChange({ ...page, issueDate: event.target.value })
            }
          />
        </label>
      </div>

      <fieldset className={styles.layoutFieldset}>
        <legend>Drawing layout</legend>
        <div className={styles.layoutOptions}>
          {DESIGN_BOOKLET_DRAWING_LAYOUT_IDS.map((layoutId) => {
            const definition = DESIGN_BOOKLET_DRAWING_LAYOUTS[layoutId];
            return (
              <button
                type="button"
                key={layoutId}
                aria-pressed={page.layout === layoutId}
                onClick={() => onChange({ ...page, layout: layoutId })}
              >
                <LayoutPreview layoutId={layoutId} />
                <strong>{definition.label}</strong>
                <span>{definition.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className={styles.drawingEditors}>
        {visibleDrawings.map((drawing, index) => (
          <DrawingSlotEditor
            key={drawing.id}
            drawing={drawing}
            asset={assets[drawing.image.assetId]}
            index={index}
            slotCount={slotCount}
            onChange={updateDrawing}
            onMove={(direction) =>
              onChange({
                ...page,
                drawings: moveDesignBookletDrawing(
                  page.drawings,
                  drawing.id,
                  direction,
                ),
              })
            }
            onReplaceAsset={onReplaceAsset}
            onSelectPdfPage={onSelectDrawingPdfPage}
            onAssetDisplayState={onAssetDisplayState}
          />
        ))}
      </div>
    </div>
  );
}

export default function BookletPageComposer({
  draft,
  selectedPageKey,
  assets,
  onSelectPage,
  onAddPage,
  onMovePage,
  onRemovePage,
  onUpdatePage,
  onUpdateFixedImage,
  onReplaceAsset,
  onReplaceDrawingPdf,
  onSelectDrawingPdfPage,
  onUseAsCover,
  onAssetDisplayState,
}: Props) {
  const model = buildDesignBookletRenderModel(draft);
  const selected =
    model.find((page) => page.key === selectedPageKey) ?? model[0];
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const addPageControlRef = useRef<HTMLDivElement>(null);
  const addPageButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAddMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!addPageControlRef.current?.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsAddMenuOpen(false);
      addPageButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAddMenuOpen]);

  function addPage(kind: DesignBookletContentLayoutId | "drawings") {
    onAddPage(kind);
    setIsAddMenuOpen(false);
  }

  return (
    <div className={styles.pageComposerWorkspace}>
      <nav className={styles.pageComposer} aria-label="Booklet pages">
        <button
          type="button"
          className={styles.fixedPageCard}
          data-booklet-page-select="cover"
          aria-current={selected.key === "cover" ? "page" : undefined}
          onClick={() => onSelectPage("cover")}
        >
          <span>01</span>
          <strong>Cover</strong>
          <small>Fixed</small>
        </button>

        {draft.contentPages.map((page, index) => {
          const resolved = model[index + 1];
          return (
            <article
              className={styles.composerPageCard}
              data-composer-page={page.id}
              key={page.id}
            >
              <button
                type="button"
                className={styles.composerPageSelect}
                data-booklet-page-select={page.id}
                aria-current={selected.key === page.id ? "page" : undefined}
                onClick={() => onSelectPage(page.id)}
              >
                <span>{String(index + 2).padStart(2, "0")}</span>
                <strong>{resolved.label}</strong>
                <small>
                  {page.kind === "image"
                    ? DESIGN_BOOKLET_CONTENT_LAYOUTS[page.layout].label
                    : DESIGN_BOOKLET_DRAWING_LAYOUTS[page.layout].label}
                </small>
              </button>
              <div className={styles.composerPageActions}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMovePage(page.id, -1)}
                  aria-label={`Move ${resolved.label} earlier`}
                  title="Move earlier"
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  disabled={index === draft.contentPages.length - 1}
                  onClick={() => onMovePage(page.id, 1)}
                  aria-label={`Move ${resolved.label} later`}
                  title="Move later"
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePage(page)}
                  aria-label={`Remove ${resolved.label}`}
                  title="Remove page"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </article>
          );
        })}

        <button
          type="button"
          className={styles.fixedPageCard}
          data-booklet-page-select="review"
          aria-current={selected.key === "review" ? "page" : undefined}
          onClick={() => onSelectPage("review")}
        >
          <span>{String(model.length).padStart(2, "0")}</span>
          <strong>Review</strong>
          <small>Fixed</small>
        </button>
      </nav>

      <div className={styles.addPageControl} ref={addPageControlRef}>
        <button
          type="button"
          ref={addPageButtonRef}
          aria-expanded={isAddMenuOpen}
          aria-controls="booklet-add-page-menu"
          onClick={() => setIsAddMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">+</span> Add page
        </button>
        {isAddMenuOpen ? (
          <div
            className={styles.addPageMenu}
            id="booklet-add-page-menu"
            aria-label="Choose page type"
          >
            <button type="button" onClick={() => addPage("visual-full-bleed")}>
              <strong>Visual</strong>
              <span>Full-bleed or framed customer imagery</span>
            </button>
            <button type="button" onClick={() => addPage("story-image-left")}>
              <strong>Image + story</strong>
              <span>One image with editable design intent</span>
            </button>
            <button type="button" onClick={() => addPage("gallery-hero-two")}>
              <strong>Gallery</strong>
              <span>Multiple renders or detail views</span>
            </button>
            <button type="button" onClick={() => addPage("information-text")}>
              <strong>Information</strong>
              <span>Text-led or two-section material pages</span>
            </button>
            <button type="button" onClick={() => addPage("drawings")}>
              <strong>Drawing page</strong>
              <span>Plan, section or elevation layouts</span>
            </button>
          </div>
        ) : null}
      </div>

      <section
        className={styles.selectedPageEditor}
        data-selected-page-editor
        aria-live="polite"
      >
        <header>
          <p className={styles.sectionEyebrow}>
            {selected.kind === "drawings" ? "Sheet settings" : "Page settings"}
          </p>
          <strong>{selected.label}</strong>
        </header>

        {selected.kind === "cover" ? (
          <ImageEditor
            eyebrow="Cover image"
            image={draft.cover}
            asset={assets[draft.cover.assetId]}
            replaceLabel="Replace cover"
            onChange={(image) => onUpdateFixedImage("cover", image)}
            onReplaceAsset={onReplaceAsset}
            onAssetDisplayState={onAssetDisplayState}
          />
        ) : null}

        {selected.kind === "image" ? (
          <ContentPageEditor
            page={selected.page}
            assets={assets}
            onChange={onUpdatePage}
            onReplaceAsset={onReplaceAsset}
            onUseAsCover={onUseAsCover}
            onAssetDisplayState={onAssetDisplayState}
          />
        ) : null}

        {selected.kind === "drawings" ? (
          <DrawingPageEditor
            page={selected.page}
            assets={assets}
            onChange={onUpdatePage}
            onReplaceAsset={onReplaceDrawingPdf}
            onSelectDrawingPdfPage={onSelectDrawingPdfPage}
            onAssetDisplayState={onAssetDisplayState}
          />
        ) : null}

        {selected.kind === "review" ? (
          <div className={styles.reviewPageEditor}>
            <p>Review copy is fixed. Choose the closing image and its focus.</p>
            <ImageEditor
              eyebrow="Final-page image"
              image={draft.reviewPage.image}
              asset={assets[draft.reviewPage.image.assetId]}
              replaceLabel="Replace final image"
              onChange={(image) => onUpdateFixedImage("review", image)}
              onReplaceAsset={onReplaceAsset}
              onAssetDisplayState={onAssetDisplayState}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
