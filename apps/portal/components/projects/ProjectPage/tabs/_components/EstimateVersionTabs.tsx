'use client';

import styles from '../EstimatesTab.module.css';

type EstimateTabItem = {
  id: string;
  label: string;
  status: string;
};

const getVersionNumber = (label: string) => {
  const match = label.match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

export default function EstimateVersionTabs({
  estimates,
  activeEstimateId,
  onSelect,
  onCreateEstimate,
}: {
  estimates: EstimateTabItem[];
  activeEstimateId: string;
  onSelect: (id: string) => void;
  onCreateEstimate?: () => void;
}) {
  const sorted = [...estimates].sort((a, b) => {
    const aNum = getVersionNumber(a.label);
    const bNum = getVersionNumber(b.label);
    if (aNum === bNum) return a.label.localeCompare(b.label);
    return aNum - bNum;
  });

  return (
    <div className={styles.versionTabsRow}>
      <div className={styles.versionTabs} role="tablist" aria-label="Estimate versions">
        {sorted.map((estimate) => {
          const isActive = estimate.id === activeEstimateId;
          return (
            <button
              key={estimate.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.versionTab} ${isActive ? styles.versionTabActive : ''}`}
              onClick={() => onSelect(estimate.id)}
              tabIndex={isActive ? 0 : -1}
            >
              {estimate.label}
            </button>
          );
        })}
        {onCreateEstimate ? (
          <button type="button" className={styles.addTab} aria-label="Create estimate" onClick={onCreateEstimate}>
            +
          </button>
        ) : null}
      </div>
    </div>
  );
}
