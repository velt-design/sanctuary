'use client';

import { type ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import SanctuaryWorkbenchRail from '@/components/drawings/rail/SanctuaryWorkbenchRail';
import type {
  ObjectWorkbenchGeometryEditIntent,
  ObjectWorkbenchGeometryEditState,
} from '@/lib/drawings/geometry/geometryEditAdapter';
import type { CommitResult } from './objectWorkbenchClientTypes';

type HouseFormAttachmentContextPanelProps = {
  moduleLabel: string;
  geometryState: ObjectWorkbenchGeometryEditState | null;
  view: ModuleViewsTab;
  disabled?: boolean;
  canStartDrawOutline?: boolean;
  onStartDrawOutline?: () => Promise<CommitResult> | CommitResult;
  onCommitGeometryEdit?: (intent: ObjectWorkbenchGeometryEditIntent) => Promise<CommitResult> | CommitResult;
};

export default function HouseFormAttachmentContextPanel({
  moduleLabel,
  geometryState,
  view,
  disabled,
  canStartDrawOutline,
  onStartDrawOutline,
  onCommitGeometryEdit,
}: HouseFormAttachmentContextPanelProps) {
  return (
    <SanctuaryWorkbenchRail
      moduleLabel={moduleLabel}
      geometryState={geometryState}
      view={view}
      disabled={disabled}
      canStartDrawOutline={canStartDrawOutline}
      onStartDrawOutline={onStartDrawOutline}
      onCommitGeometryEdit={onCommitGeometryEdit}
      chrome="embedded"
      renderSummary={false}
      // PR-T7 (2026-05-29): empty title so the embedded rail just emits
      // the field stack — the outer DIMENSIONS heading is provided by
      // HouseFormInspector. Previously the title was "Attachment Context"
      // which doubled with the inspector's own wrapper heading.
      houseContextSectionTitle=""
      sections={{
        geometry: false,
        roof: false,
        gable: false,
        houseContext: 'canonical_extras',
        supports: false,
        overrides: false,
      }}
    />
  );
}
