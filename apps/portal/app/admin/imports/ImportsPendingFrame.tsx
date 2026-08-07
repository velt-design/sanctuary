import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import styles from '@/components/ui/surface/PortalSurface.module.css';

const summaryRows = [
  ['Contacts', 'Projects'],
  ['Estimates', 'Schedule items'],
  ['Parsed files', 'Errors'],
] as const;

export default function ImportsPendingFrame() {
  return (
    <main
      className={styles.page}
      data-ui-foundation-consumer="imports"
      data-portal-page-shell="admin-imports"
      data-portal-page-shell-ready="true"
    >
      <div data-portal-shell-region="admin-imports-header">
        <StaffPageHeader
          title="Imports"
          right={
            <HeaderActions>
              <span className={styles.muted} data-portal-value-slot="loading">Loading files…</span>
              <button type="button" className={styles.button} disabled>Select JSON files</button>
            </HeaderActions>
          }
        />
      </div>
      <div className={styles.pageStack}>
        <section
          className={styles.section}
          aria-label="Import summary"
          data-portal-shell-region="admin-imports-summary"
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Summary</h2>
            <button type="button" className={styles.button} disabled>Import</button>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.tableWrap} aria-busy="true">
              <table className={styles.table}>
                <tbody>
                  {summaryRows.map(([first, second]) => (
                    <tr key={first}>
                      <th>{first}</th>
                      <td data-portal-value-slot="loading">—</td>
                      <th>{second}</th>
                      <td data-portal-value-slot="loading">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>Select one or more JSON files to preview and import.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
