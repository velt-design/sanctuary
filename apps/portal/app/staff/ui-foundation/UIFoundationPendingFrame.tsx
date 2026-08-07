import { PageLayout } from '@/components/ui/foundation';
import styles from './ui-foundation.module.css';

const headerPatterns = [
  'A. Dashboard header',
  'B. Projects index header',
  'C. Project detail header',
] as const;

export default function UIFoundationPendingFrame() {
  return (
    <PageLayout
      width="full"
      className={styles.page}
      data-ui-foundation="true"
      data-portal-page-shell="ui-foundation"
      data-portal-page-shell-ready="true"
    >
      <section
        className={styles.hero}
        aria-labelledby="foundation-title"
        data-portal-shell-region="ui-foundation-headers"
      >
        <div className={styles.heroBrand}>
          <p>Sanctuary<br />Staff Portal</p>
          <h1 id="foundation-title">UI Foundation</h1>
          <span>High-contrast. Architectural.<br />Built for Sanctuary Pergolas staff.</span>
          <div className={styles.heroMeta}><i aria-hidden="true" /> Version 1.0 <b /> 21 July 2026</div>
        </div>
        <div className={styles.headerBoard}>
          <div className={styles.sectionTitle}><h2>Page header patterns</h2><small>Approved hierarchy</small></div>
          <div className={styles.headerGrid} aria-busy="true">
            {headerPatterns.map((pattern) => (
              <article key={pattern}>
                <span className={styles.patternLabel}>{pattern}</span>
                <span data-portal-value-slot="loading">Loading example…</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className={styles.foundationGrid}
        aria-label="Design foundations"
        data-portal-shell-region="ui-foundation-tokens"
      >
        <article className={styles.catalogueSection}>
          <div className={styles.sectionTitle}><h2>1. Design tokens</h2><small>Semantic roles</small></div>
          <p data-portal-value-slot="loading">Loading token examples…</p>
        </article>
        <article className={styles.catalogueSection}>
          <div className={styles.sectionTitle}><h2>2. Typography scale</h2><small>Barlow Condensed + Inter</small></div>
          <p data-portal-value-slot="loading">Loading type examples…</p>
        </article>
      </section>

      <section
        className={styles.componentArea}
        aria-labelledby="components-heading"
        data-portal-shell-region="ui-foundation-components"
      >
        <div className={styles.sectionTitle}><h2 id="components-heading">3. Components</h2><small>Real reusable exports</small></div>
        <p data-portal-value-slot="loading">Loading component examples…</p>
      </section>

      <section
        className={styles.patterns}
        aria-label="Interaction and responsive patterns"
        data-portal-shell-region="ui-foundation-patterns"
      >
        <div className={styles.sectionTitle}><h2>4. Interaction state reference</h2><small>Authoritative visual states</small></div>
        <p data-portal-value-slot="loading">Loading interaction patterns…</p>
      </section>

      <footer className={styles.footer}>
        <span>Typography: Barlow Condensed + Inter</span>
        <span>Icons: Lucide outline</span>
        <span>Border: 1px default / 2px emphasis</span>
        <span>Radius: 0 / 2 / 4 / 999</span>
        <span>Spacing: 4px base</span>
      </footer>
    </PageLayout>
  );
}
