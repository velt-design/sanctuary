import styles from './CalculatorGrid.module.css';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import {
  ModuleDrawingRenderer,
  canEditHouseFootprintPlan,
  type ModuleFootprintEditorProps,
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
  footprintEditor?: ModuleFootprintEditorProps;
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
  footprintEditor,
}: ModuleViewsCardProps) {
  const isMinimal = presentation === 'minimal';
  const drawingSurface = isMinimal ? 'minimal' : 'card';
  const canEditFootprint = !isMinimal && view === 'plan' && Boolean(footprintEditor?.available) && canEditHouseFootprintPlan(planModel);

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
          {canEditFootprint ? (
            <button
              type="button"
              className={
                footprintEditor?.isEditing
                  ? `${styles.moduleViewsSecondaryButton} ${styles.moduleViewsSecondaryButtonActive}`
                  : styles.moduleViewsSecondaryButton
              }
              onClick={footprintEditor?.isEditing ? footprintEditor.onDoneEditing : footprintEditor?.onStartEditing}
            >
              {footprintEditor?.isEditing ? 'Done' : 'Edit footprint'}
            </button>
          ) : null}
        </div>
      </div>

      <ModuleDrawingRenderer
        view={view}
        status={status}
        statusDetail={statusDetail}
        planModel={planModel}
        sectionModel={sectionModel}
        presentation={drawingSurface}
        footprintEditor={canEditFootprint ? footprintEditor : undefined}
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
