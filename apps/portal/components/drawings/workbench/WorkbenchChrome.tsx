'use client';

import Link from '@/components/navigation/PortalRouteLink';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { preloadWorkbenchViewport } from './workbenchViewportModules';
import styles from './DrawingWorkbench.module.css';

type PrimaryNavId = 'geometry3d' | 'plan' | 'sheet';

type PrimaryNavItem = {
  id: PrimaryNavId;
  label: string;
  viewportMode: DrawingWorkbenchViewportMode;
};

// Order matches the CAD-style header mockup (3D Review → Plan Editor → Sheet
// Output): review on the left, editor in the middle, output on the right.
const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { id: 'geometry3d', label: '3D Review', viewportMode: 'geometry3d' },
  { id: 'plan', label: 'Plan Editor', viewportMode: 'plan' },
  { id: 'sheet', label: 'Sheet Output', viewportMode: 'sheet' },
];

function activeNavId(viewportMode: DrawingWorkbenchViewportMode): PrimaryNavId | null {
  if (viewportMode === 'sheet') return 'sheet';
  if (viewportMode === 'plan') return 'plan';
  if (viewportMode === 'geometry3d') return 'geometry3d';
  return null;
}

type WorkbenchChromeProps = {
  viewportMode: DrawingWorkbenchViewportMode;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  backHref?: string;
  projectLabel?: string | null;
  draftSaveAction?: {
    label: string;
    statusText: string | null;
    disabled: boolean;
    onSave: () => void;
  } | null;
};

export default function WorkbenchChrome({
  viewportMode,
  onViewportModeChange,
  backHref,
  projectLabel,
  draftSaveAction,
}: WorkbenchChromeProps) {
  const active = activeNavId(viewportMode);
  const trimmedProjectLabel = projectLabel?.trim() ?? '';

  return (
    <div className={styles.toolbar}>
      <nav
        className={styles.toolbarNav}
        aria-label="Drawing workbench primary navigation"
        data-workbench-primary-nav="true"
      >
        {trimmedProjectLabel ? (
          <div className={styles.toolbarTitle} data-workbench-title="true">
            <span className={styles.toolbarTitlePrimary}>{trimmedProjectLabel}</span>
            <span className={styles.toolbarTitleSecondary}>Design Workbench</span>
          </div>
        ) : null}
        <div className={styles.toggleGroup} role="tablist" aria-label="Drawing workbench mode">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            const preloadOnIntent = item.viewportMode === 'geometry3d'
              ? () => void preloadWorkbenchViewport(item.viewportMode)
              : undefined;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-workbench-nav-id={item.id}
                className={`${styles.toggleButton} ${isActive ? styles.toggleButtonActive : ''}`}
                onMouseEnter={preloadOnIntent}
                onFocus={preloadOnIntent}
                onPointerDown={preloadOnIntent}
                onTouchStart={preloadOnIntent}
                onClick={() => {
                  onViewportModeChange(item.viewportMode);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className={styles.toolbarActions}>
          {draftSaveAction ? (
            <div className={styles.toolbarSaveGroup}>
              <button
                type="button"
                className={styles.toolbarSaveButton}
                data-workbench-save-draft="true"
                disabled={draftSaveAction.disabled}
                onClick={draftSaveAction.onSave}
              >
                {draftSaveAction.label}
              </button>
              {draftSaveAction.statusText ? (
                <span className={styles.toolbarSaveStatus} data-workbench-save-status="true" aria-live="polite">
                  {draftSaveAction.statusText}
                </span>
              ) : null}
            </div>
          ) : null}
          {backHref ? (
            <Link href={backHref} className={styles.toolbarLink}>
              Back to Project
            </Link>
          ) : null}
          <button
            type="button"
            className={styles.toolbarOverflowButton}
            aria-label="More actions"
            data-workbench-overflow="true"
            disabled
          >
            <span aria-hidden="true">…</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
