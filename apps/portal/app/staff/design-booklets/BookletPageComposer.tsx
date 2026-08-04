import { useEffect, useRef, useState } from "react";
import {
  DESIGN_BOOKLET_DRAWING_LAYOUT_IDS,
  DESIGN_BOOKLET_DRAWING_TITLE_PRESET_IDS,
  DESIGN_BOOKLET_FOCAL_POINT_IDS,
  type DesignBookletContentPage,
  type DesignBookletDraft,
  type DesignBookletDrawingItem,
  type DesignBookletDrawingPage,
  type DesignBookletImagePlacement,
} from "@/lib/designBooklets/types";
import {
  buildDesignBookletRenderModel,
  DESIGN_BOOKLET_DRAWING_LAYOUTS,
  DESIGN_BOOKLET_FOCAL_POINTS,
  DESIGN_BOOKLET_MAX_DRAWING_PAGE_TITLE_LENGTH,
  DESIGN_BOOKLET_MAX_DRAWING_REVISION_LENGTH,
  moveDesignBookletDrawing,
  normalizeDesignBookletSheetTitle,
  visibleDesignBookletDrawings,
} from "@/lib/designBooklets/pageModel";
import type { DesignBookletPreviewAsset } from "./DesignBookletPages";
import styles from "./designBooklets.module.css";

type Props = {
  draft: DesignBookletDraft;
  selectedPageKey: string;
  assets: Record<string, DesignBookletPreviewAsset>;
  onSelectPage: (key: string) => void;
  onAddPage: (kind: "image" | "drawings") => void;
  onMovePage: (pageId: string, direction: -1 | 1) => void;
  onRemovePage: (page: DesignBookletContentPage) => void;
  onUpdatePage: (page: DesignBookletContentPage) => void;
  onUpdateFixedImage: (
    key: "cover" | "review",
    image: DesignBookletImagePlacement,
  ) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onUseAsCover: (image: DesignBookletImagePlacement) => void;
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
}: {
  eyebrow: string;
  image: DesignBookletImagePlacement;
  asset: DesignBookletPreviewAsset;
  replaceLabel: string;
  onChange: (image: DesignBookletImagePlacement) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
  onUseAsCover?: () => void;
}) {
  return (
    <div className={styles.imageEditor}>
      <div className={styles.editorImagePreview}>
        <img src={asset.src} alt="" />
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
            <button type="button" onClick={onUseAsCover}>
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
        <FocalPointControl
          value={image.focalPoint}
          onChange={(focalPoint) => onChange({ ...image, focalPoint })}
        />
      </div>
    </div>
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
}: {
  drawing: DesignBookletDrawingItem;
  asset: DesignBookletPreviewAsset;
  index: number;
  slotCount: number;
  onChange: (drawing: DesignBookletDrawingItem) => void;
  onMove: (direction: -1 | 1) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
}) {
  const titleValue =
    drawing.title.kind === "custom" ? "custom" : drawing.title.value;
  return (
    <article
      className={styles.drawingSlotEditor}
      data-drawing-editor-slot={index + 1}
    >
      <div className={styles.drawingSlotImage}>
        <img src={asset.src} alt="" />
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
          <span>Image description</span>
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
        <div className={styles.inlineActions}>
          <label className={styles.fileButton}>
            Replace drawing
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) =>
                onReplaceAsset(drawing.image.assetId, event.target.files?.[0])
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

function DrawingPageEditor({
  page,
  assets,
  onChange,
  onReplaceAsset,
}: {
  page: DesignBookletDrawingPage;
  assets: Record<string, DesignBookletPreviewAsset>;
  onChange: (page: DesignBookletDrawingPage) => void;
  onReplaceAsset: (assetId: string, file: File | undefined) => void;
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
  onUseAsCover,
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

  function addPage(kind: "image" | "drawings") {
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
                    ? "Full-page image"
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
            <button type="button" onClick={() => addPage("image")}>
              <strong>Image page</strong>
              <span>One full-page customer render</span>
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
          />
        ) : null}

        {selected.kind === "image" ? (
          <ImageEditor
            eyebrow="Full-page image"
            image={selected.page.image}
            asset={assets[selected.page.image.assetId]}
            replaceLabel="Replace image"
            onChange={(image) => onUpdatePage({ ...selected.page, image })}
            onReplaceAsset={onReplaceAsset}
            onUseAsCover={() => onUseAsCover(selected.page.image)}
          />
        ) : null}

        {selected.kind === "drawings" ? (
          <DrawingPageEditor
            page={selected.page}
            assets={assets}
            onChange={onUpdatePage}
            onReplaceAsset={onReplaceAsset}
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
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
