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

function BookletBrand({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`${styles.pageBrand} ${light ? styles.pageBrandLight : ""}`}
      aria-label="Sanctuary Pergolas"
    >
      <strong>SANCTUARY</strong>
      <span>PERGOLAS</span>
    </div>
  );
}

function PageFooter({
  pageNumber,
  pageCount,
  customerName,
  light = false,
}: {
  pageNumber: number;
  pageCount: number;
  customerName: string;
  light?: boolean;
}) {
  return (
    <footer
      className={`${styles.pageFooter} ${light ? styles.pageFooterLight : ""}`}
    >
      <span>
        SANCTUARY / DESIGN BOOKLET / {customerName.toLocaleUpperCase()}
      </span>
      <span>
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
}: {
  pageNumber: number;
  label: string;
  light?: boolean;
}) {
  return (
    <header
      className={`${styles.pageNavigation} ${light ? styles.pageNavigationLight : ""}`}
    >
      <BookletBrand light={light} />
      <span>
        {label.toLocaleUpperCase()} / {String(pageNumber).padStart(2, "0")}
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
    >
      <img
        className={styles.fullBleedImage}
        style={focalStyle(draft.cover)}
        src={asset.src}
        alt={draft.cover.altText}
      />
      <PageHeader pageNumber={1} label="Concept design" light />
      <main className={styles.coverStory}>
        <p className={styles.eyebrow}>Outdoor living by Sanctuary</p>
        <h1>{draft.projectTitle}</h1>
        <div className={styles.coverDetails}>
          <div>
            <span>Prepared for</span>
            <strong>{draft.customerName}</strong>
          </div>
          <div>
            <span>Design direction</span>
            <strong>
              {roofForm.name} / {material.label}
            </strong>
          </div>
        </div>
      </main>
      <PageFooter
        pageNumber={1}
        pageCount={pageCount}
        customerName={draft.customerName}
        light
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
        light
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
    >
      <div className={styles.pageTopRule} aria-hidden="true" />
      <PageHeader pageNumber={pageNumber} label="Drawings" />
      <main className={styles.drawingCanvas}>
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
              <div className={styles.drawingImageFrame}>
                <img src={asset.src} alt={drawing.image.altText} />
              </div>
              <figcaption>
                {designBookletDrawingTitle(drawing.title)}
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
    >
      <div className={styles.pageTopRule} aria-hidden="true" />
      <figure className={styles.reviewImage}>
        <img
          style={focalStyle(draft.reviewPage.image)}
          src={asset.src}
          alt={draft.reviewPage.image.altText}
        />
      </figure>
      <main className={styles.reviewStory}>
        <BookletBrand />
        <span className={styles.reviewPageLabel}>
          REVIEW / {String(pageNumber).padStart(2, "0")}
        </span>
        <div className={styles.reviewHeading}>
          <p className={styles.eyebrow}>{DESIGN_BOOKLET_REVIEW_COPY.eyebrow}</p>
          <h2>{DESIGN_BOOKLET_REVIEW_COPY.title}</h2>
          <p>{DESIGN_BOOKLET_REVIEW_COPY.introduction}</p>
        </div>
        <div className={styles.reviewPrompts}>
          {DESIGN_BOOKLET_REVIEW_COPY.prompts.map((prompt, index) => (
            <section key={prompt.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{prompt.title}</h3>
                <p>{prompt.copy}</p>
              </div>
            </section>
          ))}
        </div>
        <p className={styles.reviewCallToAction}>
          {DESIGN_BOOKLET_REVIEW_COPY.callToAction}
        </p>
      </main>
      <PageFooter
        pageNumber={pageNumber}
        pageCount={pageCount}
        customerName={draft.customerName}
        light
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
