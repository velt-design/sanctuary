import Link from '@/components/navigation/PortalRouteLink';
import PortalPendingValue, { PortalPendingStatus } from './PortalPendingValue';
import styles from './DesignWorkbenchPendingFrame.module.css';

const VISIBILITY_ROWS = ['House', 'Pergolas', 'Decks', 'Openings'] as const;
const OBJECT_SECTIONS = [
  ['House Forms', 'Add structure'],
  ['Pergolas', 'Add pergola'],
  ['Decks', 'Add deck'],
  ['Openings', 'Add opening'],
] as const;
const INSPECTOR_SECTIONS = [
  ['General', ['Type', 'Status', 'Position']],
  ['Dimensions', ['Length', 'Projection', 'Height']],
  ['Design', ['Roof', 'Attachment', 'Finish']],
] as const;

function VisibilityPanel() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>Visibility</h2>
      <div className={styles.visibilityList}>
        {VISIBILITY_ROWS.map((label) => (
          <div className={styles.visibilityRow} key={label}>
            <span className={styles.rowLabel}>{label}</span>
            <PortalPendingValue label={`Loading ${label.toLowerCase()} visibility`} width="short" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ObjectsPanel() {
  return (
    <div className={styles.panel} data-workbench-object-tree="true" aria-label="Workbench objects">
      {OBJECT_SECTIONS.map(([label, action]) => (
        <section className={styles.objectSection} key={label}>
          <div className={styles.objectSectionHeader}>
            <h2 className={styles.objectSectionTitle}>{label}</h2>
            <button className={styles.addAction} type="button" disabled>
              + {action}
            </button>
          </div>
          <div className={styles.objectList}>
            <div className={styles.objectRow}>
              <PortalPendingValue label={`Loading ${label.toLowerCase()}`} width="medium" />
              <PortalPendingValue label={`Loading ${label.toLowerCase()} status`} width="short" />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function WorkspaceToolbar({ projectId }: { projectId?: string | null }) {
  const backHref = projectId
    ? `/staff/projects/${encodeURIComponent(projectId)}`
    : '/staff/projects';

  return (
    <header className={styles.toolbar} data-workbench-toolbar="true">
      <div className={styles.titleGroup}>
        <span className={styles.titleSlot}>
          <PortalPendingValue label="Loading project name" width="long" />
        </span>
        <span className={styles.subtitle}>Design Workbench</span>
      </div>
      <nav className={styles.modes} aria-label="Drawing workbench primary navigation">
        <button className={styles.mode} type="button" disabled>
          3D Review
        </button>
        <button className={`${styles.mode} ${styles.modeActive}`} type="button" disabled aria-current="page">
          Plan Editor
        </button>
        <button className={styles.mode} type="button" disabled>
          Sheet Output
        </button>
      </nav>
      <div className={styles.toolbarActions}>
        <button className={styles.saveAction} type="button" disabled>
          Save workbench draft
        </button>
        <Link className={styles.backLink} href={backHref} prefetch={false}>
          Back to Project
        </Link>
        <button className={styles.overflowAction} type="button" aria-label="More actions" disabled>
          <span aria-hidden="true">&hellip;</span>
        </button>
      </div>
    </header>
  );
}

function PendingCanvas() {
  return (
    <section className={styles.canvas} aria-label="Plan editor workspace">
      <div className={styles.canvasTopbar}>
        <div className={styles.toolGroup} aria-label="Plan tools">
          {['Select', 'Move', 'Measure'].map((tool) => (
            <button className={styles.tool} type="button" disabled key={tool}>
              {tool}
            </button>
          ))}
        </div>
        <PortalPendingValue label="Loading drawing status" width="short" />
      </div>
      <div className={styles.canvasBody}>
        <div className={styles.drawingPending} aria-hidden="true">
          <div className={styles.drawingPendingLabel}>
            <PortalPendingValue label="Loading plan" width="long" />
            <span>Plan values loading</span>
          </div>
        </div>
      </div>
      <div className={styles.canvasStatusbar}>
        <span>Plan</span>
        <PortalPendingValue label="Loading drawing scale and position" width="medium" />
      </div>
    </section>
  );
}

function Inspector() {
  return (
    <aside className={styles.inspector} aria-label="Selected object inspector" data-workbench-inspector="true">
      <section className={styles.inspectorHeader}>
        <h2 className={styles.inspectorTitle}>Selected Object</h2>
        <p className={styles.inspectorMeta}>
          <PortalPendingValue label="Loading selected object" width="medium" />
        </p>
      </section>
      {INSPECTOR_SECTIONS.map(([sectionLabel, fields]) => (
        <section className={styles.panel} key={sectionLabel}>
          <h2 className={styles.panelTitle}>{sectionLabel}</h2>
          <div className={styles.fieldList}>
            {fields.map((field) => (
              <div className={styles.fieldRow} key={field}>
                <span className={styles.fieldLabel}>{field}</span>
                <PortalPendingValue label={`Loading ${field.toLowerCase()}`} width="short" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

export default function DesignWorkbenchPendingFrame({
  projectId,
}: {
  projectId?: string | null;
}) {
  return (
    <main
      className={styles.page}
      data-portal-page-shell="design-workbench"
      data-portal-page-shell-ready="true"
      data-workbench-shell-state="pending"
      data-workbench-density="compact"
      aria-busy="true"
    >
      <PortalPendingStatus>
        Design Workbench structure is ready. Project and drawing values are loading.
      </PortalPendingStatus>
      <div className={styles.shell} data-workbench-pending-frame="true">
        <aside className={styles.rail} aria-label="Workbench object rail" data-workbench-object-rail="true">
          <VisibilityPanel />
          <ObjectsPanel />
        </aside>
        <section className={styles.workspace} aria-label="Design workspace" data-workbench-workspace="true">
          <WorkspaceToolbar projectId={projectId} />
          <PendingCanvas />
        </section>
        <Inspector />
      </div>
    </main>
  );
}
