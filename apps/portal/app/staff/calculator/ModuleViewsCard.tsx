import styles from './CalculatorGrid.module.css';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import {
  ModuleDrawingRenderer,
  type ModuleViewsStatus,
  type ModuleViewsTab,
} from './ModuleDrawingRenderer';
import type { ModulePlanModel, ModuleSectionModel } from './moduleViews';

export * from './ModuleDrawingRenderer';

type ModuleViewsCardProps = {
  moduleLabel: string;
  view: ModuleViewsTab;
  onViewChange: (next: ModuleViewsTab) => void;
  status: ModuleViewsStatus;
  statusDetail?: string;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  presentation?: 'full' | 'minimal';
};

const TAB_ITEMS: Array<{ id: ModuleViewsTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'section', label: 'Section' },
];

export default function ModuleViewsCard({
  moduleLabel,
  view,
  onViewChange,
  status,
  statusDetail,
  planModel,
  sectionModel,
  presentation = 'full',
}: ModuleViewsCardProps) {
  const isMinimal = presentation === 'minimal';
  const drawingSurface = isMinimal ? 'minimal' : 'card';

  return (
    <section
      className={`${styles.moduleViewsCard} ${isMinimal ? styles.moduleViewsCardMinimal : styles.previewCard}`}
      style={moduleDrawingThemeCssVariables(drawingSurface)}
      aria-label="Module views"
    >
      <div className={styles.moduleViewsHeader}>
        {isMinimal ? null : (
          <div className={styles.moduleViewsTitleWrap}>
            <h2 className={styles.previewCardTitle}>Module views</h2>
            <div className={styles.moduleViewsSubtitle}>{moduleLabel}</div>
          </div>
        )}

        <div className={styles.moduleViewsControls}>
          <div className={styles.moduleViewsTabs} role="tablist" aria-label="View type">
            {TAB_ITEMS.map((item) => {
              const active = item.id === view;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? `${styles.moduleViewsTabButton} ${styles.moduleViewsTabButtonActive}` : styles.moduleViewsTabButton}
                  onClick={() => onViewChange(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ModuleDrawingRenderer
        view={view}
        status={status}
        statusDetail={statusDetail}
        planModel={planModel}
        sectionModel={sectionModel}
        presentation={drawingSurface}
      />

      {isMinimal ? null : (
        <div className={styles.moduleViewsMeta}>
          <span>Not to scale</span>
          <span>{view === 'plan' ? 'Plan schematic' : 'Section schematic'}</span>
        </div>
      )}
    </section>
  );
}
