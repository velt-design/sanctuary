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
  moveDesignBookletDrawing,
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
      <p>
        Keep the important part of the image visible when the page is cropped.
      </p>
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
          <small>
            Used by screen readers in this preview; it is not embedded in the
            PDF.
          </small>
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

  return (
    <>
      <div className={styles.pageComposer}>
        <button
          type="button"
          className={styles.fixedPageCard}
          aria-current={selected.key === "cover" ? "page" : undefined}
          onClick={() => onSelectPage("cover")}
        >
          <span>01</span>
          <strong>Cover</strong>
          <small>Fixed first page</small>
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
                >
                  Earlier
                </button>
                <button
                  type="button"
                  disabled={index === draft.contentPages.length - 1}
                  onClick={() => onMovePage(page.id, 1)}
                  aria-label={`Move ${resolved.label} later`}
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePage(page)}
                  aria-label={`Remove ${resolved.label}`}
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })}

        <button
          type="button"
          className={styles.fixedPageCard}
          aria-current={selected.key === "review" ? "page" : undefined}
          onClick={() => onSelectPage("review")}
        >
          <span>{String(model.length).padStart(2, "0")}</span>
          <strong>Review</strong>
          <small>Fixed final page</small>
        </button>
      </div>

      <div className={styles.addPageActions}>
        <button type="button" onClick={() => onAddPage("image")}>
          Add image page
        </button>
        <button type="button" onClick={() => onAddPage("drawings")}>
          Add drawing page
        </button>
      </div>

      <section className={styles.selectedPageEditor} aria-live="polite">
        <header>
          <div>
            <p className={styles.sectionEyebrow}>Selected page</p>
            <h3>{selected.label}</h3>
          </div>
          <span>
            {String(selected.pageNumber).padStart(2, "0")} /{" "}
            {String(selected.pageCount).padStart(2, "0")}
          </span>
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
            <p>
              The final review prompts and Sanctuary call to action are fixed.
              You can still choose the closing image and its focus.
            </p>
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
    </>
  );
}
