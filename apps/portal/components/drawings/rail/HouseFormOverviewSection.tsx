import {
  SummarySection,
  formatRotation,
  labelForAttachmentSide,
  labelForPreset,
  labelForRoofForm,
  labelForRoofReviewStatus,
} from './objectRailShared';
import type { ObjectWorkbenchHouseFormInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';

type BuildHouseFormOverviewSectionInput = {
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
};

export function buildHouseFormOverviewSection({
  houseFormContext,
}: BuildHouseFormOverviewSectionInput) {
  const houseForm = houseFormContext.houseForm;
  return (
    <SummarySection
      title="House Form Inspector"
      items={[
        { label: 'Selected form', value: houseForm?.label ?? 'Not derived yet' },
        { label: 'Roof form', value: labelForRoofForm(houseFormContext.roof.intent.form) },
        {
          label: 'Roof status',
          value: labelForRoofReviewStatus(houseFormContext.roof.validationStatus),
        },
        { label: 'Decks', value: String(houseFormContext.deckCount) },
        { label: 'Openings', value: String(houseFormContext.openingCount) },
        { label: 'Footprint', value: labelForPreset(houseForm?.footprint.preset) },
        { label: 'Rotation', value: formatRotation(houseForm?.transform.rotationQuarterTurns) },
        { label: 'Attachment side', value: labelForAttachmentSide(houseForm?.footprint.attachmentSide) },
        { label: 'Pergolas', value: String(houseFormContext.pergolaCount) },
      ]}
      hint={
        houseFormContext.lowConfidence
          ? `Compatibility warnings are present for this object-workbench form (${houseFormContext.warnings.length}).`
          : 'House Forms is the object-workbench source for footprint editing in this slice.'
      }
    />
  );
}
