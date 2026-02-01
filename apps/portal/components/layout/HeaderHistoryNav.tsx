'use client';

import styles from './PortalHeader.module.css';
import { usePortalHistory } from './usePortalHistory';

export default function HeaderHistoryNav() {
  const history = usePortalHistory();

  return (
    <div className={styles.historyCapsule} aria-label="History navigation">
      <button
        type="button"
        className={styles.historyIconButton}
        onClick={history.back}
        disabled={!history.canGoBack}
        aria-label="Back"
        title="Back"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M12.8 4.5a1 1 0 0 1 0 1.4L9.7 9h7.8a1 1 0 1 1 0 2H9.7l3.1 3.1a1 1 0 1 1-1.4 1.4l-4.8-4.8a1 1 0 0 1 0-1.4l4.8-4.8a1 1 0 0 1 1.4 0Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <span className={styles.historyDivider} aria-hidden="true" />
      <button
        type="button"
        className={styles.historyIconButton}
        onClick={history.forward}
        disabled={!history.canGoForward}
        aria-label="Forward"
        title="Forward"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M7.2 4.5a1 1 0 0 0 0 1.4L10.3 9H2.5a1 1 0 1 0 0 2h7.8l-3.1 3.1a1 1 0 1 0 1.4 1.4l4.8-4.8a1 1 0 0 0 0-1.4L8.6 4.5a1 1 0 0 0-1.4 0Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

