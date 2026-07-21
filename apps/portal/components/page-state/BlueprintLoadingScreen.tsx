import styles from './BlueprintLoadingScreen.module.css';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function BlueprintLoadingScreen({
  variant = 'page',
  message = 'Preparing workspace...',
  ariaLabel,
}: {
  variant?: 'page' | 'overlay';
  message?: string;
  ariaLabel?: string;
}) {
  const content = (
    <div
      className={cx(styles.sheet, variant === 'overlay' && styles.sheetOverlay)}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? message}
    >
      <div className={styles.drawing} aria-hidden="true">
        <svg className={styles.plan} viewBox="0 0 320 180" focusable="false">
          <path className={styles.planLineMuted} d="M36 144H284M36 36H284M36 36V144M284 36V144" />
          <path className={styles.planLine} d="M64 122V58H146V88H206V58H256V122H206V100H146V122H64Z" />
          <path className={styles.planLineAccent} d="M92 122V92H126M206 122V96H238M146 58V36M206 58V36" />
          <path className={styles.dimensionLine} d="M64 154H256M64 150V158M256 150V158" />
          <circle className={styles.setoutDot} cx="206" cy="88" r="4.5" />
        </svg>
      </div>
      <p className={styles.message}>{message}</p>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className={styles.overlay} aria-label="Page loading">
        {content}
      </div>
    );
  }

  return <main className={styles.page} data-ui-foundation-consumer="blueprint-loading">{content}</main>;
}
