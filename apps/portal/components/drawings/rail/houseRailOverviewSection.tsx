import { SummarySection, formatRotation, labelForAttachmentSide, labelForPreset, labelForRoofForm } from './houseRailShared';
import type { HouseFirstMigrationWarning, HouseModel, PergolaModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';

type BuildHouseRailOverviewSectionInput = {
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
};

export function buildHouseRailOverviewSection({
  house,
  pergolas,
  warnings,
}: BuildHouseRailOverviewSectionInput) {
  return (
    <SummarySection
      title="House Configurator"
      items={[
        { label: 'Shared house', value: house?.label ?? 'Not derived yet' },
        { label: 'Roof form', value: labelForRoofForm(house?.roof.form) },
        {
          label: 'Roof status',
          value: house?.roof.validation.status === 'invalid' ? 'Blocked' : 'Ready',
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
          ? `Migration warnings are present for the shared house (${warnings.length}).`
          : 'House mode is the shared source of truth for footprint editing in this slice.'
      }
    />
  );
}
