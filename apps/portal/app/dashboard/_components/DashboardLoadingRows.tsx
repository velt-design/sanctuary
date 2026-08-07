import dash from '../dashboard.module.css';

export default function DashboardLoadingRows({
  label,
  rows = 3,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div
      className={dash.loadingRows}
      data-dashboard-loading-rows="true"
      role="status"
      aria-label={label}
    >
      <span className={dash.loadingStatus}>{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={dash.loadingRow} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ))}
    </div>
  );
}
