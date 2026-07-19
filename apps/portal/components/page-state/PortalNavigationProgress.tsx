import styles from './PortalNavigationProgress.module.css';

export default function PortalNavigationProgress({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className={styles.progress}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-portal-route-progress="true"
    >
      <span className={styles.bar} aria-hidden="true" />
    </div>
  );
}
