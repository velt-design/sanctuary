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
      houseContextSectionTitle="Attachment Context"
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
