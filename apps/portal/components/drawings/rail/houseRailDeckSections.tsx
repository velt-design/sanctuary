import type { ReactNode } from 'react';
import { resolveDeckPlacementMode, type HouseFirstDeckDraft, type HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult, FieldErrors, RunAction } from './houseRailTypes';
import {
  ATTACHMENT_SIDE_OPTIONS,
  ActionButton,
  DECK_ELEVATION_OPTIONS,
  DECK_KIND_OPTIONS,
  DECK_SHAPE_OPTIONS,
  DECK_SURFACE_OPTIONS,
  NumberField,
  SelectField,
  TextField,
  resolveDeckPresetRectDraft,
  resolveDeckValidationSummary,
  resolveDeckWarningSummaries,
} from './houseRailShared';
import styles from './ConfiguratorRail.module.css';

type BuildHouseRailDeckSectionsInput = {
  activeDeckId?: string | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  house: HouseModel | null;
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: Partial<HouseFirstDeckDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  runDeckAction: RunAction;
};

export function buildHouseRailDeckSections({
  activeDeckId,
  disabled,
  fieldErrors,
  house,
  onAddDeck,
  onCommitDeckPatch,
  onRemoveDeck,
  onStartDeckOutline,
  runDeckAction,
}: BuildHouseRailDeckSectionsInput): ReactNode[] {
  const activeDeck = activeDeckId ? house?.decks.find((deck) => deck.id === activeDeckId) ?? null : null;
  const activeDeckPlacement = activeDeck ? resolveDeckPlacementMode(activeDeck.isAttached) : null;
  const deckValidationSummary = activeDeck ? resolveDeckValidationSummary(activeDeck) : null;
  const deckWarningSummaries = activeDeck ? resolveDeckWarningSummaries(activeDeck) : [];
  const deckButtons: ReactNode[] = [
    <div key="deck-actions" className={styles.buttonRow}>
      <ActionButton
        label="Add deck"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            'deck-add-preset',
            onAddDeck?.('preset'),
            'Unable to add a deck.',
          )
        }
      />
      <ActionButton
        label="Custom outline"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            'deck-add-custom',
            onAddDeck?.('custom_outline'),
            'Unable to start a custom deck outline.',
          )
        }
      />
    </div>,
  ];

  if (!activeDeck) {
    deckButtons.push(
      <p key="deck-empty" className={styles.empty}>
        Select a deck from the object list, or add one to start building external house context.
      </p>,
    );
    return deckButtons;
  }

  deckButtons.push(
    <div key="deck-active-summary" className={styles.inlineMeta}>
      <span className={styles.inlineLabel}>Editing</span>
      <span className={styles.inlineValue}>
        {activeDeckPlacement === 'snapped' ? 'Snapped to house edge' : 'Floating relative to house'}{' '}
        {activeDeck.shape === 'preset' ? 'rectangular preset' : 'custom outline'}
      </span>
    </div>,
    <p key="deck-selection-hint" className={styles.fieldHint}>
      {activeDeck.shape === 'preset'
        ? 'Only the selected deck shows active dimensions in plan/model space. Rectangular presets can be dragged in Model Space, snap to the house edge, or sit in floating placement with witness dimensions.'
        : 'Only the selected deck shows active dimensions in plan/model space. Custom outlines can translate as one object relative to the house, expose witness dimensions, and still use the outline edge workflow for shape changes.'}
    </p>,
    <TextField
      key="deck-name"
      label="Deck name"
      value={activeDeck.name}
      disabled={disabled}
      error={fieldErrors[`deck-name-${activeDeck.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `deck-name-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { name: value }),
          'Unable to rename the deck.',
        )
      }
    />,
    <SelectField
      key="deck-kind"
      label="Deck kind"
      value={activeDeck.kind}
      options={DECK_KIND_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-kind-${activeDeck.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `deck-kind-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { kind: value as HouseFirstDeckDraft['kind'] }),
          'Unable to update the deck kind.',
        )
      }
    />,
  );

  deckButtons.push(
    <SelectField
      key="deck-host-edge"
      label={activeDeck.isAttached ? 'Host edge' : 'Witness / snap edge'}
      value={activeDeck.hostEdgeId ?? house?.footprint.attachmentSide ?? 'rear'}
      options={ATTACHMENT_SIDE_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-host-${activeDeck.id}`]}
      helperText={
        activeDeck.isAttached
          ? 'The snapped preset rectangle rebuilds fully outside this edge.'
          : 'This edge is the current witness reference for floating dimensions and a manual snap target hint.'
      }
      onCommit={(value) =>
        runDeckAction(
          `deck-host-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { hostEdgeId: value }),
          'Unable to update the deck host edge.',
        )
      }
    />,
    <SelectField
      key="deck-shape"
      label="Shape"
      value={activeDeck.shape}
      options={DECK_SHAPE_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-shape-${activeDeck.id}`]}
      helperText="Rectangular preset is the main deck workflow. Custom outline is available when the rectangle is not enough."
      onCommit={(value) =>
        runDeckAction(
          `deck-shape-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, {
            shape: value as HouseFirstDeckDraft['shape'],
            presetType:
              value === 'preset'
                ? activeDeck.isAttached
                  ? 'rect_attached'
                  : 'rect_detached'
                : activeDeck.presetType,
          }),
          'Unable to update the deck shape.',
        )
      }
    />,
  );

  if (deckValidationSummary) {
    deckButtons.push(
      <p key="deck-invalid" className={styles.fieldError}>
        {deckValidationSummary}
      </p>,
    );
  }
  for (const [index, warning] of deckWarningSummaries.entries()) {
    deckButtons.push(
      <p key={`deck-warning-${index}`} className={styles.fieldHint}>
        {warning}
      </p>,
    );
  }

  if (activeDeck.shape === 'preset') {
    deckButtons.push(
      <NumberField
        key="deck-width"
        label="Width (m)"
        value={activeDeck.presetRect?.widthM ?? ''}
        disabled={disabled}
        error={fieldErrors[`deck-width-${activeDeck.id}`]}
        helperText="Span measured along the selected host edge."
        onCommit={(value) =>
          runDeckAction(
            `deck-width-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              presetRect: {
                ...resolveDeckPresetRectDraft(activeDeck),
                widthM: value,
              },
            }),
            'Unable to update the deck width.',
          )
        }
      />,
      <NumberField
        key="deck-depth"
        label="Depth (m)"
        value={activeDeck.presetRect?.depthM ?? ''}
        disabled={disabled}
        error={fieldErrors[`deck-depth-${activeDeck.id}`]}
        helperText="Projection outward from the selected host edge."
        onCommit={(value) =>
          runDeckAction(
            `deck-depth-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              presetRect: {
                ...resolveDeckPresetRectDraft(activeDeck),
                depthM: value,
              },
            }),
            'Unable to update the deck depth.',
          )
        }
      />,
      <NumberField
        key="deck-center-offset"
        label="Center offset (m)"
        value={activeDeck.presetRect?.centerOffsetM ?? ''}
        disabled={disabled}
        error={fieldErrors[`deck-center-offset-${activeDeck.id}`]}
        helperText="Signed offset from the host-edge midpoint."
        onCommit={(value) =>
          runDeckAction(
            `deck-center-offset-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              presetRect: {
                ...resolveDeckPresetRectDraft(activeDeck),
                centerOffsetM: value,
              },
            }),
            'Unable to update the deck center offset.',
          )
        }
      />,
    );

    if (activeDeck.isAttached) {
      deckButtons.push(
        <p key="deck-model-space-hint" className={styles.fieldHint}>
          In Model Space, select this deck to edit width/depth plus host-edge start and end gaps. Drag the deck body to move it along the house edge or pull it into floating placement.
        </p>,
      );
    }

    if (!activeDeck.isAttached) {
      deckButtons.push(
        <NumberField
          key="deck-detached-gap"
          label="Reference edge gap (m)"
          value={activeDeck.presetRect?.detachedGapM ?? ''}
          disabled={disabled}
          error={fieldErrors[`deck-detached-gap-${activeDeck.id}`]}
          helperText="Perpendicular clearance from the current witness reference edge."
          onCommit={(value) =>
            runDeckAction(
              `deck-detached-gap-${activeDeck.id}`,
              onCommitDeckPatch?.(activeDeck.id, {
                presetRect: {
                  ...resolveDeckPresetRectDraft(activeDeck),
                  detachedGapM: value,
                },
              }),
              'Unable to update the detached gap.',
            )
          }
        />,
      );
    }
  }

  deckButtons.push(
    <SelectField
      key="deck-elevation"
      label="Elevation mode"
      value={activeDeck.elevationMode}
      options={DECK_ELEVATION_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-elevation-${activeDeck.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `deck-elevation-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { elevationMode: value as HouseFirstDeckDraft['elevationMode'] }),
          'Unable to update the deck elevation mode.',
        )
      }
    />,
    <NumberField
      key="deck-offset"
      label="Level offset (mm)"
      value={activeDeck.levelOffsetMm}
      disabled={disabled}
      error={fieldErrors[`deck-offset-${activeDeck.id}`]}
      helperText="One scalar height offset for the deck top surface."
      onCommit={(value) =>
        runDeckAction(
          `deck-offset-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { levelOffsetMm: value }),
          'Unable to update the deck level offset.',
        )
      }
    />,
    <SelectField
      key="deck-surface"
      label="Surface material"
      value={activeDeck.surfaceMaterial}
      options={DECK_SURFACE_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-surface-${activeDeck.id}`]}
      onCommit={(value) =>
        runDeckAction(
          `deck-surface-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { surfaceMaterial: value as HouseFirstDeckDraft['surfaceMaterial'] }),
          'Unable to update the deck material.',
        )
      }
    />,
    <div key="deck-edit-actions" className={styles.buttonRow}>
      <ActionButton
        label="Redraw outline"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            `deck-outline-${activeDeck.id}`,
            onStartDeckOutline?.(activeDeck.id),
            'Unable to start deck outline drawing.',
          )
        }
      />
      <ActionButton
        label="Remove deck"
        disabled={disabled}
        onClick={() =>
          void runDeckAction(
            `deck-remove-${activeDeck.id}`,
            onRemoveDeck?.(activeDeck.id),
            'Unable to remove the deck.',
          )
        }
      />
    </div>,
  );

  return deckButtons;
}
