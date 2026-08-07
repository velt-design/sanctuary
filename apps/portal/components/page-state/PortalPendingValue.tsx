import styles from './PortalPendingValue.module.css';

type PortalPendingValueWidth = 'short' | 'medium' | 'long' | 'full';

export default function PortalPendingValue({
  label,
  width = 'medium',
}: {
  label: string;
  width?: PortalPendingValueWidth;
}) {
  return (
    <span
      className={`${styles.value} ${styles[width]}`}
      data-portal-value-slot="loading"
      aria-label={label}
    >
      <span className={styles.screenReaderOnly}>{label}</span>
    </span>
  );
}

export function PortalPendingStatus({ children }: { children: string }) {
  return (
    <span className={styles.screenReaderOnly} role="status">
      {children}
    </span>
  );
}
