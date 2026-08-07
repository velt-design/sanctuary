import styles from './costingControl.module.css';

const workflowSteps = ['Overview', 'Edit settings', 'Review impact', 'Publish'] as const;
const statusLabels = ['Active pricing', 'Latest draft', 'Your working state'] as const;
const historyHeaders = [
  'Name and purpose',
  'State',
  'Based on',
  'Last activity',
  'Publication audit note',
  'Action',
] as const;

export default function CostingControlPendingFrame() {
  return (
    <main
      className={styles.page}
      data-portal-page-shell="admin-costing"
      data-portal-page-shell-ready="true"
      data-costing-background-ready="false"
    >
      <header className={styles.header} data-portal-shell-region="admin-costing-header">
        <div>
          <div className={styles.eyebrow}>Pricebook</div>
          <h1 className={styles.title}>Costing control centre</h1>
          <p className={styles.lede}>
            Refine supported rates and allowances, see the likely pricing impact, then publish a fully audited version for future estimates.
          </p>
        </div>
        <button className={styles.button} type="button" disabled>
          <span data-portal-value-slot="loading">Loading pricing…</span>
        </button>
      </header>

      <nav
        className={styles.workflow}
        aria-label="Costing workflow"
        data-portal-shell-region="admin-costing-workflow"
      >
        {workflowSteps.map((step, index) => (
          <button
            key={step}
            type="button"
            disabled
            aria-current={index === 0 ? 'step' : undefined}
            className={`${styles.workflowStep} ${index === 0 ? styles.workflowCurrent : ''}`}
          >
            <span>{index + 1}</span>
            {step}
          </button>
        ))}
      </nav>

      <section
        className={styles.statusGrid}
        aria-label="Pricing configuration status"
        data-portal-shell-region="admin-costing-status"
      >
        {statusLabels.map((label) => (
          <div className={`${styles.statusCard} ${styles.statusCard_neutral}`} key={label}>
            <span className={styles.statusLabel}>{label}</span>
            <strong data-portal-value-slot="loading">Loading…</strong>
            <small data-portal-value-slot="loading">Current pricing information is updating.</small>
          </div>
        ))}
      </section>

      <section className={styles.onboardingCard} data-portal-shell-region="admin-costing-overview">
        <div>
          <div className={styles.eyebrow}>Step 1 · Overview</div>
          <h2>Pricing overview</h2>
          <p data-portal-value-slot="loading">Loading the current version and draft state…</p>
        </div>
        <button className={styles.button} type="button" disabled>Open draft</button>
      </section>

      <section className={styles.card} data-portal-shell-region="admin-costing-history">
        <div className={styles.cardHeader}>
          <div>
            <h2>Version history</h2>
            <p className={styles.muted}>Drafts, publication notes and immutable pricing records.</p>
          </div>
          <span className={styles.muted} data-portal-value-slot="loading">Loading versions…</span>
        </div>
        <div className={styles.tableWrap} aria-busy="true">
          <table className={styles.table}>
            <thead>
              <tr>{historyHeaders.map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((row) => (
                <tr key={row}>
                  {historyHeaders.map((header) => (
                    <td key={header}><span data-portal-value-slot="loading">—</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
