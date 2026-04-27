import type { ReactNode } from 'react';
import type { HouseFirstOpeningDraft, HouseModel, WallOpeningHostSide } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult, FieldErrors, RunAction } from './houseRailTypes';
import { ATTACHMENT_SIDE_OPTIONS, ActionButton, NumberField, TextField, SelectField } from './houseRailShared';
import styles from './ConfiguratorRail.module.css';

type BuildHouseRailOpeningSectionsInput = {
  activeOpeningId?: string | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  house: HouseModel | null;
  onAddOpening?: () => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: Partial<HouseFirstOpeningDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  onSelectOpening?: (openingId: string | null) => void;
  runDeckAction: RunAction;
};

export function buildHouseRailOpeningSections({
  activeOpeningId,
  disabled,
  fieldErrors,
  house,
  onAddOpening,
  onCommitOpeningPatch,
  onRemoveOpening,
  onSelectOpening,
  runDeckAction,
}: BuildHouseRailOpeningSectionsInput): ReactNode[] {
  const activeOpening =
    house?.openings.find((opening) => opening.id === activeOpeningId) ?? house?.openings[0] ?? null;
  const openingValidationSummary = activeOpening?.validation.message ?? null;
  const sections: ReactNode[] = [
    <div key="opening-actions" className={styles.buttonRow}>
      <ActionButton
        label="Add window"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            'opening-add-window',
            onAddOpening?.(),
            'Unable to add a window.',
          )
        }
      />
    </div>,
  ];

  if (!activeOpening) {
    sections.push(
      <p key="opening-empty" className={styles.empty}>
        Add a shared window to start editing host-wall openings in house mode.
      </p>,
    );
    return sections;
  }

  sections.push(
    <div key="opening-list" className={styles.buttonRow}>
      {house?.openings.map((opening) => (
        <button
          key={opening.id}
          type="button"
          className={opening.id === activeOpening.id ? styles.buttonPrimary : styles.overlayButton}
          disabled={disabled}
          onClick={() => onSelectOpening?.(opening.id)}
        >
          {opening.label}
        </button>
      ))}
    </div>,
    <p key="opening-selection-hint" className={styles.fieldHint}>
      Selected openings show width and along-wall offset dimensions in Model Space plan. Drag the selected opening body there to reposition it along the host wall. Height and base height stay editable in the rail for this slice.
    </p>,
    <TextField
      key="opening-label"
      label="Opening label"
      value={activeOpening.label}
      disabled={disabled}
      error={fieldErrors[`opening-label-${activeOpening.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `opening-label-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { label: value }),
          'Unable to rename the opening.',
        )
      }
    />,
    <SelectField
      key="opening-wall"
      label="Host wall"
      value={activeOpening.wallId ?? house?.footprint.attachmentSide ?? 'rear'}
      options={ATTACHMENT_SIDE_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`opening-wall-${activeOpening.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `opening-wall-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { wallId: value as WallOpeningHostSide }),
          'Unable to update the host wall.',
        )
      }
    />,
    <NumberField
      key="opening-width"
      label="Opening width (m)"
      value={activeOpening.widthM}
      disabled={disabled}
      error={fieldErrors[`opening-width-${activeOpening.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `opening-width-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { widthM: value }),
          'Unable to update the opening width.',
        )
      }
    />,
    <NumberField
      key="opening-height"
      label="Opening height (m)"
      value={activeOpening.heightM}
      disabled={disabled}
      error={fieldErrors[`opening-height-${activeOpening.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `opening-height-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { heightM: value }),
          'Unable to update the opening height.',
        )
      }
    />,
    <NumberField
      key="opening-sill-height"
      label="Opening base height (m)"
      value={activeOpening.sillHeightM}
      disabled={disabled}
      error={fieldErrors[`opening-sill-height-${activeOpening.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `opening-sill-height-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { sillHeightM: value }),
          'Unable to update the opening base height.',
        )
      }
    />,
    <NumberField
      key="opening-offset"
      label="Offset along wall (m)"
      value={activeOpening.offsetAlongWallM}
      disabled={disabled}
      error={fieldErrors[`opening-offset-${activeOpening.id}`]}
      helperText="Measured from the selected wall start in the current house-side frame."
      onCommit={(value) =>
        runDeckAction(
          `opening-offset-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { offsetAlongWallM: value }),
          'Unable to update the along-wall offset.',
        )
      }
    />,
    <div key="opening-edit-actions" className={styles.buttonRow}>
      <ActionButton
        label="Remove opening"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            `opening-remove-${activeOpening.id}`,
            onRemoveOpening?.(activeOpening.id),
            'Unable to remove the opening.',
          )
        }
      />
    </div>,
  );

  if (openingValidationSummary) {
    sections.push(
      <p key="opening-invalid" className={styles.fieldError}>
        {openingValidationSummary}
      </p>,
    );
  }

  return sections;
}
