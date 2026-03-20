'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from '../EstimatesTab.module.css';

type EstimateTabItem = {
  id: string;
  label: string;
  isActiveDraft?: boolean;
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
    if (aNum === bNum) return b.label.localeCompare(a.label);
    return bNum - aNum;
  });
  const activeEstimate = sorted.find((estimate) => estimate.id === activeEstimateId) ?? sorted[0] ?? null;
  const formatLabel = (estimate: EstimateTabItem) => (estimate.isActiveDraft ? 'Current draft design' : `Design ${estimate.label}`);
  const activeLabel = activeEstimate ? formatLabel(activeEstimate) : 'Select design';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.versionMenuTrigger} aria-label="Select design version">
          <span className={styles.versionMenuTriggerLabel}>{activeLabel}</span>
          <span className={styles.versionMenuTriggerChevron} aria-hidden="true">
            v
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className={styles.versionMenuContent}>
        {sorted.map((estimate) => {
          const isActive = estimate.id === activeEstimateId;
          return (
            <DropdownMenuItem
              key={estimate.id}
              className={`${styles.versionMenuItem} ${isActive ? styles.versionMenuItemActive : ''}`}
              onSelect={() => onSelect(estimate.id)}
            >
              <span className={styles.versionMenuItemLabel}>{formatLabel(estimate)}</span>
              {isActive ? <span className={styles.versionMenuItemMeta}>Current</span> : null}
            </DropdownMenuItem>
          );
        })}
        {onCreateEstimate ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={`${styles.versionMenuItem} ${styles.versionMenuCreateItem}`} onSelect={onCreateEstimate}>
              <span className={styles.versionMenuItemLabel}>Start new design revision</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
