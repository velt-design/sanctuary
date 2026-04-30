import {
  SummarySection,
  formatRotation,
  labelForAttachmentSide,
  labelForPreset,
  labelForRoofForm,
  labelForRoofReviewStatus,
} from './objectRailShared';
import type { HouseFirstMigrationWarning, HouseModel, PergolaModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';

type BuildHouseFormOverviewSectionInput = {
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
};

export function buildHouseFormOverviewSection({
  house,
  pergolas,
  warnings,
}: BuildHouseFormOverviewSectionInput) {
  return (
    <SummarySection
      title="House Form Inspector"
      items={[
        { label: 'Selected form', value: house?.label ?? 'Not derived yet' },
        { label: 'Roof form', value: labelForRoofForm(house?.roof.form) },
        {
          label: 'Roof status',
          value: labelForRoofReviewStatus(house?.roof.validation.status),
        },
        { label: 'Decks', value: String(house?.decks.length ?? 0) },
        { label: 'Openings', value: String(house?.openings.length ?? 0) },
        { label: 'Footprint', value: labelForPreset(house?.footprint.preset) },
        { label: 'Rotation', value: formatRotation(house?.footprint.drawingRotationQuarterTurns) },
        { label: 'Attachment side', value: labelForAttachmentSide(house?.footprint.attachmentSide) },
        { label: 'Pergolas', value: String(pergolas.length) },
      ]}
      hint={
        house?.lowConfidence
          ? `Migration warnings are present for the compatibility house form (${warnings.length}).`
          : 'House Forms is the compatibility source for footprint editing in this slice.'
      }
    />
  );
}
