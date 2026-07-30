import type { CSSProperties } from "react";
import type {
  DesignBookletContentCatalog,
  DesignBookletDefaultAssetId,
  DesignBookletDraft,
  DesignBookletImagePlacement,
} from "@/lib/designBooklets/types";
import {
  buildDesignBookletRenderModel,
  DESIGN_BOOKLET_DRAWING_LAYOUTS,
  DESIGN_BOOKLET_FOCAL_POINTS,
  DESIGN_BOOKLET_REVIEW_COPY,
  designBookletDrawingTitle,
  visibleDesignBookletDrawings,
} from "@/lib/designBooklets/pageModel";
import {
  DESIGN_BOOKLET_PRESENTATION,
  designBookletCssBaselineOffset,
  normalizeDesignBookletPresentationText,
  type DesignBookletPresentationFontRole,
} from "@/lib/designBooklets/presentation";
import styles from "./designBookletPages.module.css";

export type DesignBookletPreviewAsset = {
  id: string;
  src: string;
  alt: string;
  label: string;
  defaultAssetId: DesignBookletDefaultAssetId;
  file?: File;
};

type Props = {
  selectedPageKey: string;
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  assets: Record<string, DesignBookletPreviewAsset>;
};

type BookletPageStyle = CSSProperties & {
  "--booklet-page-height": string;
  "--booklet-page-width": string;
};

const presentation = DESIGN_BOOKLET_PRESENTATION;
const BOOKLET_PAGE_STYLE: BookletPageStyle = {
  "--booklet-page-height": String(presentation.page.height),
  "--booklet-page-width": String(presentation.page.width),
};

function point(value: number): string {
  return `calc(var(--booklet-point) * ${value})`;
}

function baselineTextStyle(
  baseline: number,
  size: number,
  options: {
    left?: number;
    right?: number;
    width?: number;
    lineHeight?: number;
    fontRole?: DesignBookletPresentationFontRole;
  } = {},
): CSSProperties {
  const lineHeight = options.lineHeight ?? size;
  return {
    top: point(
      baseline -
        designBookletCssBaselineOffset(size, lineHeight, options.fontRole),
    ),
    left: options.left === undefined ? undefined : point(options.left),
    right: options.right === undefined ? undefined : point(options.right),
    width: options.width === undefined ? undefined : point(options.width),
    fontSize: point(size),
    lineHeight: point(lineHeight),
  };
}

function BookletBrand({
  light = false,
  x = presentation.chrome.insetLeft,
}: {
  light?: boolean;
  x?: number;
}) {
  const header = presentation.chrome.header;
  return (
    <div
      className={`${styles.pageBrand} ${light ? styles.pageBrandLight : ""}`}
      aria-label="Sanctuary Pergolas"
      style={{ left: point(x) }}
    >
      <strong
        style={baselineTextStyle(
          header.brandPrimaryBaseline,
          header.brandPrimarySize,
          {
            lineHeight: header.brandPrimaryLineHeight,
            fontRole: "display",
          },
        )}
      >
        SANCTUARY
      </strong>
      <span
        style={baselineTextStyle(
          header.brandSecondaryBaseline,
          header.brandSecondarySize,
          { lineHeight: header.brandSecondaryLineHeight },
        )}
      >
        PERGOLAS
      </span>
    </div>
  );
}

function PageFooter({
  pageNumber,
  pageCount,
  customerName,
  tone = "dark",
}: {
  pageNumber: number;
  pageCount: number;
  customerName: string;
  tone?: "dark" | "light" | "split";
}) {
  const footer = presentation.chrome.footer;
  return (
    <footer
      className={`${styles.pageFooter} ${
        tone === "light"
          ? styles.pageFooterLight
          : tone === "split"
            ? styles.pageFooterSplit
            : ""
      }`}
      style={{
        left: point(presentation.chrome.insetLeft),
        right: point(presentation.chrome.insetRight),
        top: point(footer.ruleTop),
      }}
    >
      <span
        style={baselineTextStyle(
          footer.labelBaseline - footer.ruleTop,
          footer.labelSize,
          { lineHeight: footer.labelLineHeight },
        )}
      >
        SANCTUARY / DESIGN BOOKLET /{" "}
        {normalizeDesignBookletPresentationText(customerName).toUpperCase()}
      </span>
      <span
        style={baselineTextStyle(
          footer.labelBaseline - footer.ruleTop,
          footer.pageNumberSize,
          { lineHeight: footer.labelLineHeight },
        )}
      >
        {String(pageNumber).padStart(2, "0")} /{" "}
        {String(pageCount).padStart(2, "0")}
      </span>
    </footer>
  );
}

function PageHeader({
  pageNumber,
  label,
  light = false,
  muted = false,
}: {
  pageNumber: number;
  label: string;
  light?: boolean;
  muted?: boolean;
}) {
  const header = presentation.chrome.header;
  return (
    <header
      className={`${styles.pageNavigation} ${light ? styles.pageNavigationLight : ""} ${muted ? styles.pageNavigationMuted : ""}`}
    >
      <BookletBrand light={light} />
      <span
        style={baselineTextStyle(header.labelBaseline, header.labelSize, {
          right: presentation.chrome.insetRight,
          lineHeight: header.labelLineHeight,
        })}
      >
        {normalizeDesignBookletPresentationText(label).toUpperCase()} /{" "}
        {String(pageNumber).padStart(2, "0")}
      </span>
    </header>
  );
}

function focalStyle(placement: DesignBookletImagePlacement) {
  const focus = DESIGN_BOOKLET_FOCAL_POINTS[placement.focalPoint];
  return { objectPosition: `${focus.x}% ${focus.y}%` };
}

function CoverPage({
  draft,
  content,
  asset,
  pageCount,
}: {
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  asset: DesignBookletPreviewAsset;
  pageCount: number;
}) {
  const roofForm = content.roofForms[draft.roofFormId];
  const material = content.materials[draft.materialId];
  return (
    <article
      className={`${styles.page} ${styles.coverPage}`}
      data-booklet-page="1"
      data-page-key="cover"
      data-page-kind="cover"
      aria-label={`Booklet page 1 of ${pageCount}`}
      style={BOOKLET_PAGE_STYLE}
    >
      <img
        className={styles.fullBleedImage}
        style={focalStyle(draft.cover)}
        src={asset.src}
        alt={draft.cover.altText}
      />
      <PageHeader pageNumber={1} label="Concept design" light />
      <main
        className={styles.coverStory}
        style={{
          left: point(presentation.cover.story.x),
          bottom: point(presentation.cover.story.bottom),
          width: point(presentation.cover.story.width),
        }}
      >
        <p
          className={styles.eyebrow}
          style={{
            fontSize: point(presentation.cover.eyebrow.size),
            lineHeight: point(presentation.cover.eyebrow.lineHeight),
          }}
        >
          Outdoor living by Sanctuary
        </p>
        <h1
          style={{
            width: point(presentation.cover.title.width),
            marginTop: point(presentation.cover.title.marginTop),
            fontSize: point(presentation.cover.title.size),
            lineHeight: point(presentation.cover.title.lineHeight),
          }}
        >
          {normalizeDesignBookletPresentationText(draft.projectTitle)}
        </h1>
        <div
          className={styles.coverDetails}
          style={{
            width: point(presentation.cover.details.width),
            gridTemplateColumns: `${point(
              presentation.cover.details.prepared.width,
            )} ${point(presentation.cover.details.direction.width)}`,
            columnGap: point(presentation.cover.details.gap),
            marginTop: point(presentation.cover.details.marginTop),
            paddingTop: point(presentation.cover.details.paddingTop),
          }}
        >
          <div>
            <span
              style={{
                fontSize: point(presentation.cover.details.label.size),
                lineHeight: point(presentation.cover.details.label.lineHeight),
              }}
            >
              Prepared for
            </span>
            <strong
              style={{
                marginTop: point(presentation.cover.details.value.marginTop),
                fontSize: point(presentation.cover.details.value.size),
                lineHeight: point(presentation.cover.details.value.lineHeight),
              }}
            >
              {normalizeDesignBookletPresentationText(draft.customerName)}
            </strong>
          </div>
          <div>
            <span
              style={{
                fontSize: point(presentation.cover.details.label.size),
                lineHeight: point(presentation.cover.details.label.lineHeight),
              }}
            >
              Design direction
            </span>
            <strong
              style={{
                width: point(presentation.cover.details.direction.width),
                marginTop: point(presentation.cover.details.value.marginTop),
                fontSize: point(presentation.cover.details.value.size),
                lineHeight: point(presentation.cover.details.value.lineHeight),
              }}
            >
              {normalizeDesignBookletPresentationText(
                `${roofForm.name} / ${material.label}`,
              )}
            </strong>
          </div>
        </div>
      </main>
      <PageFooter
        pageNumber={1}
        pageCount={pageCount}
        customerName={draft.customerName}
        tone="light"
      />
    </article>
  );
}

function ImagePage({
  draft,
  pageNumber,
  pageCount,
  placement,
  asset,
}: {
  draft: DesignBookletDraft;
  pageNumber: number;
  pageCount: number;
  placement: DesignBookletImagePlacement;
  asset: DesignBookletPreviewAsset;
}) {
  return (
    <article
      className={`${styles.page} ${styles.imagePage}`}
      data-booklet-page={pageNumber}
      data-page-kind="image"
      aria-label={`Booklet page ${pageNumber} of ${pageCount}`}
      style={BOOKLET_PAGE_STYLE}
    >
      <img
        className={styles.fullBleedImage}
        style={focalStyle(placement)}
        src={asset.src}
        alt={placement.altText}
      />
      <div className={styles.imageChromeShade} aria-hidden="true" />
      <PageHeader pageNumber={pageNumber} label="Concept image" light />
      <PageFooter
        pageNumber={pageNumber}
        pageCount={pageCount}
        customerName={draft.customerName}
        tone="light"
      />
    </article>
  );
}

function DrawingPage({
  draft,
  pageNumber,
  pageCount,
  page,
  assets,
}: {
  draft: DesignBookletDraft;
  pageNumber: number;
  pageCount: number;
  page: Extract<
    DesignBookletDraft["contentPages"][number],
    { kind: "drawings" }
  >;
  assets: Record<string, DesignBookletPreviewAsset>;
}) {
  const layout = DESIGN_BOOKLET_DRAWING_LAYOUTS[page.layout];
  const drawings = visibleDesignBookletDrawings(page);
  return (
    <article
      className={`${styles.page} ${styles.standardPage} ${styles.drawingPage}`}
      data-booklet-page={pageNumber}
      data-page-kind="drawings"
      data-drawing-layout={page.layout}
      aria-label={`Booklet page ${pageNumber} of ${pageCount}`}
      style={BOOKLET_PAGE_STYLE}
    >
      <div className={styles.pageTopRule} aria-hidden="true" />
      <PageHeader pageNumber={pageNumber} label="Drawings" muted />
      <main
        className={styles.drawingCanvas}
        style={{
          left: point(presentation.drawing.area.x),
          top: point(presentation.drawing.area.top),
          width: point(presentation.drawing.area.width),
          height: point(presentation.drawing.area.height),
        }}
      >
        {drawings.map((drawing, index) => {
          const frame = layout.frames[index];
          const asset = assets[drawing.image.assetId];
          return (
            <figure
              className={styles.drawingFigure}
              data-drawing-slot={index + 1}
              key={drawing.id}
              style={{
                left: `${frame.x * 100}%`,
                top: `${frame.y * 100}%`,
                width: `${frame.width * 100}%`,
                height: `${frame.height * 100}%`,
              }}
            >
              <div
                className={styles.drawingImageFrame}
                style={{
                  bottom: point(presentation.drawing.caption.reserveHeight),
                }}
              >
                <img src={asset.src} alt={drawing.image.altText} />
              </div>
              <figcaption
                style={{
                  top: `calc(100% - var(--booklet-point) * ${
                    presentation.drawing.caption.baselineFromBottom +
                    designBookletCssBaselineOffset(
                      presentation.drawing.caption.size,
                      presentation.drawing.caption.lineHeight,
                      "display",
                    )
                  })`,
                  right: point(presentation.drawing.caption.insetX),
                  left: point(presentation.drawing.caption.insetX),
                  fontSize: point(presentation.drawing.caption.size),
                  lineHeight: point(presentation.drawing.caption.lineHeight),
                }}
              >
                {normalizeDesignBookletPresentationText(
                  designBookletDrawingTitle(drawing.title),
                )}
              </figcaption>
            </figure>
          );
        })}
      </main>
      <PageFooter
        pageNumber={pageNumber}
        pageCount={pageCount}
        customerName={draft.customerName}
      />
    </article>
  );
}

function ReviewPage({
  draft,
  pageNumber,
  pageCount,
  asset,
}: {
  draft: DesignBookletDraft;
  pageNumber: number;
  pageCount: number;
  asset: DesignBookletPreviewAsset;
}) {
  return (
    <article
      className={`${styles.page} ${styles.standardPage} ${styles.reviewPage}`}
      data-booklet-page={pageNumber}
      data-page-key="review"
      data-page-kind="review"
      aria-label={`Booklet page ${pageNumber} of ${pageCount}`}
      style={BOOKLET_PAGE_STYLE}
    >
      <div className={styles.pageTopRule} aria-hidden="true" />
      <figure
        className={styles.reviewImage}
        style={{
          left: point(presentation.review.image.x),
          top: point(presentation.review.image.top),
          width: point(presentation.review.image.width),
          height: point(presentation.review.image.height),
        }}
      >
        <img
          style={focalStyle(draft.reviewPage.image)}
          src={asset.src}
          alt={draft.reviewPage.image.altText}
        />
      </figure>
      <div
        className={styles.reviewPaper}
        aria-hidden="true"
        style={{
          left: point(presentation.review.story.x),
          width: point(presentation.review.story.width),
        }}
      />
      <main className={styles.reviewStory}>
        <BookletBrand x={presentation.review.copy.x} />
        <span
          className={styles.reviewPageLabel}
          style={baselineTextStyle(
            presentation.chrome.header.labelBaseline,
            presentation.chrome.header.labelSize,
            { right: presentation.chrome.insetRight },
          )}
        >
          REVIEW / {String(pageNumber).padStart(2, "0")}
        </span>
        <div className={styles.reviewHeading}>
          <p
            className={styles.eyebrow}
            style={baselineTextStyle(
              presentation.review.eyebrow.baseline,
              presentation.typography.eyebrowSize,
              {
                left: presentation.review.copy.x,
                lineHeight: presentation.typography.eyebrowLineHeight,
              },
            )}
          >
            {DESIGN_BOOKLET_REVIEW_COPY.eyebrow}
          </p>
          <h2
            style={baselineTextStyle(
              presentation.review.title.baseline,
              presentation.review.title.size,
              {
                left: presentation.review.copy.x,
                width: presentation.review.copy.width,
                lineHeight: presentation.review.title.lineHeight,
                fontRole: "display",
              },
            )}
          >
            {DESIGN_BOOKLET_REVIEW_COPY.title}
          </h2>
          <p
            style={baselineTextStyle(
              presentation.review.introduction.baseline,
              presentation.review.introduction.size,
              {
                left: presentation.review.copy.x,
                width: presentation.review.copy.width,
                lineHeight: presentation.review.introduction.lineHeight,
              },
            )}
          >
            {DESIGN_BOOKLET_REVIEW_COPY.introduction}
          </p>
        </div>
        <div
          className={styles.reviewPrompts}
          style={{
            left: point(presentation.review.copy.x),
            top: point(presentation.review.prompts[0].ruleTop),
            width: point(presentation.review.copy.width),
            height: point(
              presentation.review.finalPromptRuleTop -
                presentation.review.prompts[0].ruleTop,
            ),
          }}
        >
          {DESIGN_BOOKLET_REVIEW_COPY.prompts.map((prompt, index) => (
            <section
              key={prompt.title}
              style={{
                top: point(
                  presentation.review.prompts[index].ruleTop -
                    presentation.review.prompts[0].ruleTop,
                ),
                height: point(presentation.review.prompts[index].rowHeight),
                paddingTop: point(
                  presentation.review.prompts[index].paddingTop,
                ),
                gridTemplateColumns: `${point(
                  presentation.review.prompts[index].numberWidth,
                )} minmax(0, 1fr)`,
                columnGap: point(presentation.review.prompts[index].gap),
              }}
            >
              <span
                style={{
                  fontSize: point(
                    presentation.review.prompts[index].numberSize,
                  ),
                  lineHeight: point(
                    presentation.review.prompts[index].numberLineHeight,
                  ),
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3
                  style={{
                    fontSize: point(
                      presentation.review.prompts[index].titleSize,
                    ),
                    lineHeight: point(
                      presentation.review.prompts[index].titleLineHeight,
                    ),
                  }}
                >
                  {prompt.title}
                </h3>
                <p
                  style={{
                    marginTop: point(
                      presentation.review.prompts[index].copyMarginTop,
                    ),
                    fontSize: point(
                      presentation.review.prompts[index].copySize,
                    ),
                    lineHeight: point(
                      presentation.review.prompts[index].copyLineHeight,
                    ),
                  }}
                >
                  {prompt.copy}
                </p>
              </div>
            </section>
          ))}
        </div>
        <p
          className={styles.reviewCallToAction}
          style={baselineTextStyle(
            presentation.review.callToAction.baseline,
            presentation.review.callToAction.size,
            {
              left: presentation.review.copy.x,
              width: presentation.review.copy.width,
              lineHeight: presentation.review.callToAction.lineHeight,
              fontRole: "display",
            },
          )}
        >
          {DESIGN_BOOKLET_REVIEW_COPY.callToAction}
        </p>
      </main>
      <PageFooter
        pageNumber={pageNumber}
        pageCount={pageCount}
        customerName={draft.customerName}
        tone="split"
      />
    </article>
  );
}

export default function DesignBookletPages({
  selectedPageKey,
  draft,
  content,
  assets,
}: Props) {
  const model = buildDesignBookletRenderModel(draft);
  const resolvedPage =
    model.find((page) => page.key === selectedPageKey) ?? model[0];

  if (resolvedPage.kind === "cover") {
    return (
      <CoverPage
        draft={draft}
        content={content}
        asset={assets[draft.cover.assetId]}
        pageCount={resolvedPage.pageCount}
      />
    );
  }

  if (resolvedPage.kind === "image") {
    return (
      <ImagePage
        draft={draft}
        pageNumber={resolvedPage.pageNumber}
        pageCount={resolvedPage.pageCount}
        placement={resolvedPage.page.image}
        asset={assets[resolvedPage.page.image.assetId]}
      />
    );
  }

  if (resolvedPage.kind === "drawings") {
    return (
      <DrawingPage
        draft={draft}
        pageNumber={resolvedPage.pageNumber}
        pageCount={resolvedPage.pageCount}
        page={resolvedPage.page}
        assets={assets}
      />
    );
  }

  return (
    <ReviewPage
      draft={draft}
      pageNumber={resolvedPage.pageNumber}
      pageCount={resolvedPage.pageCount}
      asset={assets[draft.reviewPage.image.assetId]}
    />
  );
}
