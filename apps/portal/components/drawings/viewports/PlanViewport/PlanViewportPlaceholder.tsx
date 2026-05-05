export function PlanViewportPlaceholder() {
  return (
    <section
      data-plan-viewport="true"
      data-plan-render-status="no_artifact"
      aria-label="Plan editor viewport"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        color: '#555',
        fontSize: '0.9rem',
      }}
    >
      <p data-plan-viewport-placeholder>Plan view unavailable: no solved geometry artifact.</p>
    </section>
  );
}
