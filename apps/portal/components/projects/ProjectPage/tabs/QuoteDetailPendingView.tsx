import ProjectPendingValue, {
  ProjectPendingStatus,
} from '../ProjectPendingValue';
import styles from './QuotesTab.module.css';

const DETAIL_FIELDS = [
  'Prepared for (snapshot)',
  'Current contact',
  'Quote number',
  'Issue date / Expiry date',
  'Reference',
  'Deposit %',
];

export function QuotePreviewPendingView({ onBack }: { onBack?: () => void }) {
  return (
    <div
      className={styles.wrapper}
      role="region"
      aria-label="Quote detail"
      data-quotes-view="detail"
      data-quote-view-mode="preview"
      data-portal-page-shell="quote-preview"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <ProjectPendingStatus>
        Quote preview structure is ready. The server-rendered document is loading.
      </ProjectPendingStatus>
      <div className={styles.detailHeader}>
        <button type="button" className={styles.backButton} onClick={onBack} disabled={!onBack}>
          &lt; Back
        </button>
        <div className={styles.detailActions}>
          <button type="button" className={styles.primaryButton} disabled>Review &amp; send</button>
          <button type="button" className={styles.secondaryButton} disabled>More</button>
        </div>
      </div>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Quote preview</h4>
        </div>
        <div className={styles.quotePreviewFrameWrap}>
          <ProjectPendingValue label="Rendering quote preview" width="full" />
        </div>
      </section>
    </div>
  );
}

export default function QuoteDetailPendingView({
  onBack,
}: {
  onBack?: () => void;
}) {
  return (
    <div
      className={styles.wrapper}
      role="region"
      aria-label="Quote detail"
      data-quotes-view="detail"
      data-portal-page-shell="quote-detail"
      data-portal-page-shell-ready="true"
      aria-busy="true"
    >
      <ProjectPendingStatus>
        Quote detail structure is ready. Commercial values are loading from the server.
      </ProjectPendingStatus>
      <div className={styles.detailHeader}>
        <button type="button" className={styles.backButton} onClick={onBack} disabled={!onBack}>
          &lt; Back
        </button>
        <div className={styles.detailActions}>
          <button type="button" className={styles.primaryButton} disabled>
            Review &amp; send
          </button>
          <button type="button" className={styles.secondaryButton} disabled>
            More
          </button>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Quote details</h4>
          <ProjectPendingValue label="Loading quote status" width="short" />
        </div>
        <div className={styles.metaGrid}>
          {DETAIL_FIELDS.map((field) => (
            <div className={styles.metaBlock} key={field}>
              <div className={styles.metaLabel}>{field}</div>
              <div className={styles.metaValue}>
                <ProjectPendingValue label={`Loading ${field.toLowerCase()}`} width="medium" />
              </div>
              <div className={styles.metaValueMuted}>
                <ProjectPendingValue label={`Loading ${field.toLowerCase()} detail`} width="short" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Line items</h4>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.lineTable} aria-label="Quote line items">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }, (_, rowIndex) => (
                <tr key={rowIndex} data-portal-table-row="loading">
                  {['Description', 'Quantity', 'Unit price', 'Total', 'Actions'].map((column, columnIndex) => (
                    <td key={column}>
                      <ProjectPendingValue
                        label={`Loading line item ${column.toLowerCase()}`}
                        width={columnIndex === 0 ? 'long' : 'short'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Totals</h4>
        </div>
        <div className={styles.totalsGrid}>
          {['Total (inc GST)', 'Total (ex GST)', 'GST'].map((label) => (
            <div className={styles.totalItem} key={label}>
              <div className={styles.metaLabel}>{label}</div>
              <ProjectPendingValue label={`Loading ${label.toLowerCase()}`} width="medium" />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Intro &amp; Terms</h4>
        </div>
        <div className={styles.splitGrid}>
          {['Intro', 'Terms'].map((label) => (
            <div key={label}>
              <div className={styles.metaLabel}>{label}</div>
              <ProjectPendingValue label={`Loading quote ${label.toLowerCase()}`} width="full" />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h4 className={styles.cardTitle}>Send log</h4>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.logTable} aria-label="Quote send log">
            <thead>
              <tr>
                <th>Sent to</th>
                <th>Subject</th>
                <th>When</th>
                <th>Status</th>
                <th>Attachments</th>
              </tr>
            </thead>
            <tbody>
              <tr data-portal-table-row="loading">
                {['recipient', 'subject', 'time', 'status', 'attachments'].map((column) => (
                  <td key={column}>
                    <ProjectPendingValue label={`Loading send ${column}`} width="medium" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
