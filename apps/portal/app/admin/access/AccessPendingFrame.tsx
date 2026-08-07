import StaffPageHeader from '@/components/layout/StaffPageHeader';
import styles from './access.module.css';

const crewHeaders = [
  'Reorder',
  'Color',
  'Name',
  'Region',
  'Base available',
  'Active',
  'Board jobs',
  'Actions',
] as const;

export default function AccessPendingFrame() {
  return (
    <div
      className={styles.page}
      data-ui-foundation-consumer="admin-access"
      data-portal-page-shell="admin-access"
      data-portal-page-shell-ready="true"
      data-admin-access-background-ready="false"
    >
      <div data-portal-shell-region="admin-access-header">
        <StaffPageHeader title="Access" />
      </div>

      <div className={styles.card} data-portal-shell-region="admin-access-user">
        <p className={styles.intro}>
          Create a portal user (or update an existing one) with a temporary password. The user can log in immediately.
        </p>
        <form className={styles.form} aria-label="Portal user access">
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} type="email" placeholder="name@sanctuarypergolas.co.nz" disabled />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Role</span>
              <select className={styles.select} disabled defaultValue="staff">
                <option value="staff">Staff</option>
              </select>
            </label>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>Temporary password</span>
            <div className={styles.passwordRow}>
              <input className={styles.input} type="password" disabled />
              <button type="button" className={styles.buttonSecondary} disabled>Generate</button>
              <button type="button" className={styles.buttonSecondary} disabled>Show</button>
            </div>
            <span className={styles.helper}>Use at least 8 characters. You can change it later.</span>
          </label>
          <div className={styles.actions}>
            <button className={styles.buttonPrimary} type="button" disabled>Set temp password</button>
            <span className={styles.helper}>Creates the user if missing and assigns portal role.</span>
          </div>
        </form>
      </div>

      <div className={styles.card} data-portal-shell-region="admin-access-crews">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Schedule crews</h2>
          <p className={styles.sectionHelper}>
            Manage the crews shown in Schedule (Board/Gantt). Deactivation is blocked while a crew has jobs visible on the board.
          </p>
        </div>
        <form className={styles.crewAddForm} aria-label="Add schedule crew">
          {['Name', 'Color', 'Region', 'Base available date'].map((label) => (
            <label className={styles.field} key={label}>
              <span className={styles.label}>{label}</span>
              <input className={styles.input} disabled />
            </label>
          ))}
          <div className={styles.addCrewActions}>
            <button className={styles.buttonPrimary} type="button" disabled>Add crew</button>
          </div>
        </form>
        <div
          className={styles.crewTableWrap}
          role="region"
          aria-label="Schedule crews table"
          aria-busy="true"
        >
          <table className={styles.crewTable}>
            <thead>
              <tr>{crewHeaders.map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={crewHeaders.length} className={styles.loadingCrewRow}>
                  <span data-portal-value-slot="loading" role="status">Loading crew values…</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
