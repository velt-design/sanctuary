import PageHeader from '@/components/layout/PageHeader';
import stateStyles from '@/components/page-state/PageState.module.css';
import dash from './dashboard.module.css';

export default function DashboardPendingView({
  failed = false,
  onRetry,
}: {
  failed?: boolean;
  onRetry?: () => void;
}) {
  return (
    <main
      className={dash.page}
      data-ui-foundation-consumer="dashboard"
      data-dashboard-state={failed ? 'refresh-failed' : 'pending'}
      data-dashboard-background-ready="false"
    >
      <PageHeader variant="dashboard" title="Dashboard" eyebrow="Welcome back" />

      <div className={dash.pendingLayout}>
        <section className={dash.pendingCard} role="status" aria-live="polite">
          <h2 className={dash.pendingTitle}>
            {failed ? 'Could not load the dashboard' : 'Updating dashboard...'}
          </h2>
          <p className={dash.pendingDescription}>
            {failed
              ? 'The portal could not refresh this information. You can try again without leaving the page.'
              : 'The latest pipeline, project actions, estimates, activity, and tasks will appear here shortly.'}
          </p>
          {failed && onRetry ? (
            <button type="button" className={stateStyles.secondaryAction} onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
