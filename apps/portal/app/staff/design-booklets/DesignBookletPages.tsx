import type {
  DesignBookletContentCatalog,
  DesignBookletDraft,
  DesignBookletRenderId,
} from "@/lib/designBooklets/types";
import {
  DESIGN_BOOKLET_PAGE_COUNT,
  DESIGN_BOOKLET_REFERENCE_ASSETS,
} from "@/lib/designBooklets/defaults";
import styles from "./designBooklets.module.css";

export type DesignBookletPreviewAsset = {
  id: DesignBookletRenderId | "plan";
  src: string;
  alt: string;
  label: string;
  file?: File;
};

type Props = {
  pageNumber: number;
  draft: DesignBookletDraft;
  content: DesignBookletContentCatalog;
  assets: Record<DesignBookletRenderId | "plan", DesignBookletPreviewAsset>;
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
  customerName,
  light = false,
}: {
  pageNumber: number;
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
        {String(DESIGN_BOOKLET_PAGE_COUNT).padStart(2, "0")}
      </span>
    </footer>
  );
}

function StandardPage({
  pageNumber,
  customerName,
  className = "",
  children,
}: {
  pageNumber: number;
  customerName: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`${styles.page} ${styles.standardPage} ${className}`}
      data-booklet-page={pageNumber}
      aria-label={`Booklet page ${pageNumber} of ${DESIGN_BOOKLET_PAGE_COUNT}`}
    >
      <div className={styles.pageTopRule} aria-hidden="true" />
      {children}
      <PageFooter pageNumber={pageNumber} customerName={customerName} />
    </article>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export default function DesignBookletPages({
  pageNumber,
  draft,
  content,
  assets,
}: Props) {
  const roofForm = content.roofForms[draft.roofFormId];
  const material = content.materials[draft.materialId];
  const orderedRenders = draft.renderOrder.map((id) => assets[id]);
  const roofFormReference =
    DESIGN_BOOKLET_REFERENCE_ASSETS.roofForms[draft.roofFormId];
  const roofingSections = material.sections.map((section) => ({
    ...section,
    image: DESIGN_BOOKLET_REFERENCE_ASSETS.roofing[section.id],
  }));

  if (pageNumber === 1) {
    return (
      <article
        className={`${styles.page} ${styles.coverPage}`}
        data-booklet-page="1"
        aria-label={`Booklet page 1 of ${DESIGN_BOOKLET_PAGE_COUNT}`}
      >
        <img
          className={styles.coverImage}
          src={orderedRenders[0].src}
          alt={orderedRenders[0].alt}
        />
        <header className={styles.coverNavigation}>
          <BookletBrand light />
          <span>CONCEPT DESIGN / 01</span>
        </header>
        <main className={styles.coverStory}>
          <Eyebrow>Outdoor living by Sanctuary</Eyebrow>
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
        <PageFooter pageNumber={1} customerName={draft.customerName} light />
      </article>
    );
  }

  if (pageNumber === 2) {
    return (
      <StandardPage
        pageNumber={2}
        customerName={draft.customerName}
        className={styles.overviewPage}
      >
        <figure className={styles.overviewVisual}>
          <img src={orderedRenders[1].src} alt={orderedRenders[1].alt} />
          <figcaption>RENDER 02 / CURRENT CONCEPT</figcaption>
        </figure>
        <main className={styles.overviewStory}>
          <BookletBrand />
          <div className={styles.overviewCopy}>
            <Eyebrow>Your design</Eyebrow>
            <h2>The design, at a glance.</h2>
            <section className={styles.overviewFact}>
              <span>01 / Roof form</span>
              <h3>{roofForm.name}</h3>
              <p>{roofForm.proposition}</p>
            </section>
            <section className={styles.overviewFact}>
              <span>02 / Roofing choice</span>
              <h3>{material.label}</h3>
              <p>{material.summary}</p>
            </section>
          </div>
        </main>
      </StandardPage>
    );
  }

  if (pageNumber === 3) {
    return (
      <article
        className={`${styles.page} ${styles.featurePage}`}
        data-booklet-page="3"
        aria-label={`Booklet page 3 of ${DESIGN_BOOKLET_PAGE_COUNT}`}
      >
        <img
          className={styles.featureImage}
          src={orderedRenders[2].src}
          alt={orderedRenders[2].alt}
        />
        <header className={styles.featureNavigation}>
          <BookletBrand light />
          <span>DESIGN VIEW / 03</span>
        </header>
        <div className={styles.featureStatement}>
          <Eyebrow>Design view</Eyebrow>
          <h2>The outdoor room, seen as a whole.</h2>
          <span>RENDER 03 / CURRENT CONCEPT</span>
        </div>
        <PageFooter pageNumber={3} customerName={draft.customerName} light />
      </article>
    );
  }

  if (pageNumber === 4) {
    return (
      <StandardPage
        pageNumber={4}
        customerName={draft.customerName}
        className={styles.planPage}
      >
        <main className={styles.planStory}>
          <BookletBrand />
          <div>
            <Eyebrow>Concept plan</Eyebrow>
            <h2>The design from above.</h2>
            <p>Plan 01 / Current concept</p>
          </div>
        </main>
        <figure className={styles.planVisual}>
          <img src={assets.plan.src} alt={assets.plan.alt} />
        </figure>
      </StandardPage>
    );
  }

  if (pageNumber === 5) {
    return (
      <StandardPage
        pageNumber={5}
        customerName={draft.customerName}
        className={styles.formPage}
      >
        <figure className={styles.formVisual}>
          <img src={roofFormReference.src} alt={roofFormReference.alt} />
          <figcaption>
            BUILT REFERENCE / {roofForm.shortName.toLocaleUpperCase()}
          </figcaption>
        </figure>
        <main className={styles.formStory}>
          <BookletBrand light />
          <div>
            <Eyebrow>Roof form</Eyebrow>
            <h2>{roofForm.name}</h2>
            <p className={styles.formOutcome}>{roofForm.outcomeHeading}</p>
            <p className={styles.formIntroduction}>{roofForm.outcomeCopy}</p>
          </div>
          <div className={styles.formFit}>
            <section>
              <span>Useful when</span>
              <p>{roofForm.worksWhen[0]}</p>
            </section>
            <section>
              <span>Confirm</span>
              <p>{roofForm.resolve[0]}</p>
            </section>
          </div>
        </main>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      pageNumber={6}
      customerName={draft.customerName}
      className={styles.materialPage}
    >
      <header className={styles.materialIntro}>
        <BookletBrand light />
        <div>
          <Eyebrow>Roofing choice</Eyebrow>
          <h2>
            {roofingSections.length === 2
              ? "Two roofing zones."
              : material.label}
          </h2>
          <p className={styles.bookletClosing}>
            {draft.projectTitle} / prepared for {draft.customerName}
          </p>
        </div>
      </header>
      <main
        className={styles.materialSections}
        data-section-count={roofingSections.length}
      >
        {roofingSections.map((section, index) => (
          <section key={section.id}>
            <figure>
              <img src={section.image.src} alt={section.image.alt} />
            </figure>
            <div>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{section.label}</h3>
              <p>{section.summary}</p>
            </div>
          </section>
        ))}
      </main>
    </StandardPage>
  );
}
