import styles from './designBooklets.module.css';

const pages = ['Cover', 'Image 1', 'Image 2', 'Proposed roof plan', 'Review'] as const;

export default function DesignBookletPendingFrame({
  projectId,
}: {
  projectId?: string | null;
}) {
  const linkedProjectId = projectId?.trim() || null;

  return (
    <main
      className={styles.workbench}
      data-design-booklet-workbench
      data-portal-page-shell="design-booklets"
      data-portal-page-shell-ready="true"
      data-project-state={linkedProjectId ? 'pending' : undefined}
      data-project-id={linkedProjectId || undefined}
      data-design-booklet-mode={linkedProjectId ? 'project' : 'standalone'}
      data-design-booklet-background-ready={linkedProjectId ? 'false' : 'true'}
    >
      <header
        className={styles.siteHeader}
        data-portal-shell-region="design-booklets-header"
      >
        <a className={styles.siteBrand} href="#booklet-preview">
          <strong>SANCTUARY</strong>
          <span>DESIGN BOOKLETS</span>
        </a>
        <div className={styles.headerStatus}>
          <span>{linkedProjectId ? 'Project booklet' : 'Standalone booklet'}</span>
          <strong data-portal-value-slot={linkedProjectId ? 'loading' : undefined}>
            {linkedProjectId ? 'Loading project…' : 'Preview only · not saved'}
          </strong>
        </div>
        <div className={styles.headerActions}>
          {linkedProjectId ? (
            <a
              className={styles.returnLink}
              href={`/staff/projects/${encodeURIComponent(linkedProjectId)}`}
            >
              Return to project
            </a>
          ) : null}
          <button type="button" className={styles.primaryButton} disabled>Download PDF</button>
        </div>
      </header>

      <div className={styles.workspace}>
        <aside
          className={styles.controlRail}
          aria-label="Booklet controls"
          data-portal-shell-region="design-booklets-controls"
        >
          <details className={styles.bookletDetails} id="booklet-details">
            <summary>
              <span className={styles.detailsSummaryCopy}>
                <span className={styles.sectionEyebrow}>Booklet details</span>
                <strong data-portal-value-slot="loading">Loading booklet title…</strong>
                <span data-portal-value-slot="loading">Loading roof and material…</span>
              </span>
              <span className={styles.detailsToggle} aria-hidden="true">Edit</span>
            </summary>
          </details>

          <section className={styles.railSection} id="booklet-pages">
            <header className={styles.railSectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Booklet structure</p>
                <h2>Pages</h2>
              </div>
              <span>05</span>
            </header>
            <div className={styles.pageComposerWorkspace} aria-busy="true">
              <div className={styles.pageComposer}>
                {pages.map((page, index) => (
                  <button type="button" className={styles.fixedPageCard} disabled key={page}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{page}</strong>
                    <small data-portal-value-slot="loading">Loading page values…</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </aside>

        <section
          className={styles.previewWorkspace}
          id="booklet-preview"
          aria-label="Landscape A4 booklet preview"
          aria-busy="true"
          data-portal-shell-region="design-booklets-preview"
        >
          <header className={styles.previewToolbar}>
            <div>
              <p className={styles.sectionEyebrow}>Page preview</p>
              <h2>Cover</h2>
            </div>
            <div className={styles.previewControls}>
              <span>01 / 05</span>
              <button type="button" disabled>Previous</button>
              <button type="button" disabled>Next</button>
            </div>
          </header>
          <div className={styles.previewCanvas}>
            <div className={styles.pageStage}>
              <div className={styles.pendingBookletPage} data-portal-value-slot="loading">
                Loading booklet preview…
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
