'use client';

import { ModuleDrawingRenderer, type ModuleViewsStatus, type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import styles from './ModelSpaceViewport.module.css';

export default function ModelSpaceViewport({
  view,
  status,
  planModel,
  sectionModel,
}: {
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
}) {
  const viewLabel = view === 'plan' ? 'Plan' : 'Section';

  return (
    <section className={styles.viewport} aria-label={`${viewLabel} model space viewport`} style={moduleDrawingThemeCssVariables('model')}>
      <div className={styles.canvas}>
        <ModuleDrawingRenderer
          view={view}
          status={status}
          planModel={planModel}
          sectionModel={sectionModel}
          presentation="model"
        />
      </div>
    </section>
  );
}
