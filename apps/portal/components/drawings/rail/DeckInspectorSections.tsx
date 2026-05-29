import type { ReactNode } from 'react';
import type {
  ObjectWorkbenchDeckInspectorModel,
  ObjectWorkbenchDeckPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { DeckObjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import {
  ActionButton,
  DECK_SHAPE_OPTIONS,
  DECK_SURFACE_OPTIONS,
  NumberField,
  SelectField,
  resolveDeckPresetRectDraft,
  resolveDeckValidationSummary,
  resolveDeckWarningSummaries,
} from './objectRailShared';
import styles from './WorkbenchRail.module.css';

type BuildDeckInspectorSectionsInput = {
  activeDeck: ObjectWorkbenchDeckInspectorModel | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export function buildDeckInspectorSections({
  activeDeck,
  disabled,
  fieldErrors,
  onCommitDeckPatch,
  onRemoveDeck,
  onStartDeckOutline,
  runAction,
}: BuildDeckInspectorSectionsInput): ReactNode[] {
  const activeDeckPlacement = activeDeck?.isAttached ? 'snapped' : 'floating';
  const deckValidationSummary = activeDeck ? resolveDeckValidationSummary(activeDeck) : null;
  const deckWarningSummaries = activeDeck ? resolveDeckWarningSummaries(activeDeck) : [];
  // PR-T9 (2026-05-29): top-row `Add deck` + `Custom outline` action
  // buttons removed — the left rail already renders `+ Add deck`, and the
  // Shape dropdown below is the canonical place to switch preset/custom.
  const deckButtons: ReactNode[] = [];

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
    <div key="deck-trust" className={styles.inlineMeta}>
      <span className={styles.inlineLabel}>Trust</span>
      <span className={styles.inlineValue}>{activeDeck.trustLabel}</span>
    </div>,
    <p key="deck-selection-hint" className={styles.fieldHint}>
      {activeDeck.shape === 'preset'
        ? 'Only the selected deck shows active dimensions in plan/model space. Rectangular presets can be dragged in Model Space, snap to the house edge, or sit in floating placement with witness dimensions.'
        : 'Only the selected deck shows active dimensions in plan/model space. Custom outlines can translate as one object relative to the house, expose witness dimensions, and still use the outline edge workflow for shape changes.'}
    </p>,
  );

  // PR-T9 (2026-05-29): `Deck name` text field, `Deck kind` select, and
  // `Host edge / Witness edge` select removed. Name auto-derives from
  // index; kind was never branched on by costing/geometry; host edge is
  // snap-derived by `buildDeckCommitPatch` and the inspector dropdown
  // misled users into thinking they could override the snap result.
  deckButtons.push(
    <SelectField
      key="deck-shape"
      label="Shape"
      value={activeDeck.shape}
      options={DECK_SHAPE_OPTIONS}
      disabled={disabled}
      error={fieldErrors[`deck-shape-${activeDeck.id}`]}
      helperText="Rectangular preset is the main deck workflow. Custom outline is available when the rectangle is not enough."
      onCommit={(value) =>
        runAction(
          `deck-shape-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, {
            shape: value as DeckObjectModel['shape'],
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
          runAction(
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
          runAction(
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
          runAction(
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
            runAction(
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

  // PR-T9 (2026-05-29): `Elevation mode` dropdown removed. Geometry no
  // longer branches on `elevationMode`; the inspector field had three
  // options when the only effective branch was `'ground'` (clamp negative
  // offsets) vs not-ground.
  deckButtons.push(
    <NumberField
      key="deck-offset"
      label="Level offset (mm)"
      value={activeDeck.levelOffsetMm}
      disabled={disabled}
      error={fieldErrors[`deck-offset-${activeDeck.id}`]}
      helperText="One scalar height offset for the deck top surface."
      onCommit={(value) =>
        runAction(
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
        runAction(
          `deck-surface-${activeDeck.id}`,
          onCommitDeckPatch?.(activeDeck.id, { surfaceMaterial: value as DeckObjectModel['surfaceMaterial'] }),
          'Unable to update the deck material.',
        )
      }
    />,
    <div key="deck-edit-actions" className={styles.buttonRow}>
      <ActionButton
        label="Redraw outline"
        disabled={disabled}
        onClick={() =>
          void runAction(
            `deck-outline-${activeDeck.id}`,
            onStartDeckOutline?.(activeDeck.id),
            'Unable to start deck outline drawing.',
          )
        }
      />
      <ActionButton
        label="Reset position"
        disabled={disabled}
        onClick={() =>
          void runAction(
            `deck-reset-position-${activeDeck.id}`,
            onCommitDeckPatch?.(activeDeck.id, {
              position: null,
              shape: 'preset',
              presetType: activeDeck.isAttached ? 'rect_attached' : 'rect_detached',
            }),
            'Unable to reset the deck position.',
          )
        }
      />
      <ActionButton
        label="Remove deck"
        disabled={disabled}
        onClick={() =>
          void runAction(
            `deck-remove-${activeDeck.id}`,
            onRemoveDeck?.(activeDeck.id),
            'Unable to remove the deck.',
          )
        }
      />
    </div>,
    <p key="deck-reset-hint" className={styles.fieldHint}>
      Reset position clears the deck&apos;s world-space position and reverts the
      shape to a default rectangle. Use it to recover a deck that has drifted
      off-canvas; the deck record (host edge, material) is preserved.
    </p>,
  );

  return deckButtons;
}
