import PortalPendingValue, {
  PortalPendingStatus,
} from '@/components/page-state/PortalPendingValue';
import styles from './CalculatorShellPendingFrame.module.css';

const RESULT_TABS = ['Pricing', 'Materials', 'Labour', 'Workings', 'Issues'];

export default function CalculatorShellPendingFrame({
  workspace = 'standalone',
}: {
  workspace?: 'standalone' | 'project';
}) {
  const embedded = workspace === 'project';

  return (
    <div
      className={styles.shell}
      data-project-calculator={embedded ? 'true' : undefined}
      data-project-calculator-state={embedded ? 'pending' : undefined}
      data-calculator-workspace={workspace}
      data-portal-page-shell={embedded ? 'project-calculator' : 'calculator'}
      data-portal-page-shell-ready="true"
      data-ui-foundation-consumer="calculator"
    >
      <PortalPendingStatus>
        {embedded
          ? 'Calculator structure is ready. The selected design values are loading.'
          : 'Calculator structure is ready. Project and design values are loading.'}
      </PortalPendingStatus>
      <header className={styles.commandBar} data-calculator-command-bar>
        <div className={styles.identity} data-calculator-command-identity>
          <strong>Calculator</strong>
          <div className={styles.commandMeta}>
            <PortalPendingValue
              label={embedded ? 'Loading design version' : 'Loading selected project'}
              width="medium"
            />
            <span>Editing draft</span>
            <span>Module 1</span>
          </div>
        </div>
        <div className={styles.commandActions} data-calculator-command-actions>
          <PortalPendingValue label="Loading calculator readiness" width="short" />
          <div className={styles.mode} aria-label="Calculator detail level">
            <button type="button" disabled>Basic</button>
            <button type="button" disabled>Advanced</button>
          </div>
          <button type="button" disabled>Save draft</button>
        </div>
      </header>

      <div className={styles.workspace} data-calculator-split="true">
        <div className={styles.configuration} data-calculator-configuration-workspace>
          <aside className={styles.moduleRail} aria-label="Design modules">
            <span className={styles.railTitle}>Design modules</span>
            <div className={styles.moduleItem}>
              <strong>Module 1</strong>
              <PortalPendingValue label="Loading module summary" width="medium" />
            </div>
            <button type="button" disabled>Add module</button>
          </aside>
          <div
            className={styles.form}
            data-calculator-configuration-form
            data-calculator-presentation={embedded ? 'embedded' : 'standalone'}
          >
            {[
              ['Structure', ['Pergola style', 'Roof type', 'Span', 'Projection']],
              ['Site & workflow', ['Project reference', 'Region', 'Access', 'Installation']],
            ].map(([title, fields]) => (
              <section
                className={styles.section}
                data-calculator-configuration-section={String(title).toLowerCase().replaceAll(' ', '-')}
                key={String(title)}
              >
                <h2>{String(title)}</h2>
                <div className={styles.fieldGrid} data-calculator-field-grid>
                  {(fields as string[]).map((field) => (
                    <div className={styles.field} data-calculator-field={field.toLowerCase().replaceAll(' ', '-')} key={field}>
                      <span className={styles.label}>{field}</span>
                      <PortalPendingValue label={`Loading ${field.toLowerCase()}`} width="full" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside
          className={styles.resultInspector}
          aria-label="Calculator result inspector"
          data-calculator-result-inspector
          data-active-result-tab="pricing"
        >
          <div className={styles.resultHeader}>
            <h2>Result inspector</h2>
            <PortalPendingValue label="Loading result readiness" width="short" />
          </div>
          <div className={styles.resultTabs} role="tablist" aria-label="Result inspector sections">
            {RESULT_TABS.map((tab, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={index === 0}
                tabIndex={index === 0 ? 0 : -1}
                disabled
                key={tab}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.resultBody}>
            <section className={styles.priceCard} aria-label="Customer price">
              <span className={styles.label}>Customer price</span>
              <PortalPendingValue label="Loading customer price" width="long" />
              <PortalPendingValue label="Loading price readiness detail" width="full" />
            </section>
            <section className={styles.resultCard} aria-label="Design preview">
              <span className={styles.label}>Design preview</span>
              <PortalPendingValue label="Loading design preview" width="full" />
              <PortalPendingValue label="Loading design measurements" width="long" />
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
