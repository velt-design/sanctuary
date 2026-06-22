import type { ReactNode } from 'react';
import type { OpeningObjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchOpeningInspectorModel,
  ObjectWorkbenchOpeningPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import { ActionButton, NumberField, TextField, SelectField } from './objectRailShared';
import styles from './WorkbenchRail.module.css';

const OPENING_TYPE_OPTIONS = [
  { label: 'Window', value: 'window' },
  { label: 'Hinged door', value: 'hinged_door' },
  { label: 'Slider', value: 'slider' },
  { label: 'Stacker', value: 'stacker' },
] as const;

const SLIDER_PANEL_COUNT_OPTIONS = [
  { label: '2 panels', value: '2' },
  { label: '3 panels', value: '3' },
  { label: '4 panels', value: '4' },
] as const;

type BuildOpeningInspectorSectionsInput = {
  activeOpening: ObjectWorkbenchOpeningInspectorModel | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  onAddOpening?: (
    kind: 'window' | 'hinged_door' | 'slider' | 'stacker'
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export function buildOpeningInspectorSections({
  activeOpening,
  disabled,
  fieldErrors,
  onAddOpening,
  onCommitOpeningPatch,
  onRemoveOpening,
  runAction,
}: BuildOpeningInspectorSectionsInput): ReactNode[] {
  const openingValidationSummary = activeOpening?.validation.message ?? null;
  const sections: ReactNode[] = [
    <div key="opening-actions" className={styles.buttonRow}>
      <ActionButton
        label="Add window"
        disabled={disabled}
        onClick={() =>
          void runAction(
            'opening-add-window',
            onAddOpening?.('window'),
            'Unable to add a window.',
          )
        }
      />
      <ActionButton
        label="Add door"
        disabled={disabled}
        onClick={() =>
          void runAction(
            'opening-add-door',
            onAddOpening?.('hinged_door'),
            'Unable to add a door.',
          )
        }
      />
      <ActionButton
        label="Add slider"
        disabled={disabled}
        onClick={() =>
          void runAction(
            'opening-add-slider',
            onAddOpening?.('slider'),
            'Unable to add a slider.',
          )
        }
      />
      <ActionButton
        label="Add stacker"
        disabled={disabled}
        onClick={() =>
          void runAction(
            'opening-add-stacker',
            onAddOpening?.('stacker'),
            'Unable to add a stacker.',
          )
        }
      />
    </div>,
  ];

  if (!activeOpening) {
    sections.push(
      <p key="opening-empty" className={styles.empty}>
        Select an opening from the object list, or add one to start editing derived-wall-hosted openings.
      </p>,
    );
    return sections;
  }

  const hostWallOptions = activeOpening.hostWallOptions.length
    ? activeOpening.hostWallOptions
    : [{ label: 'No derived walls available', value: '' }];
  const hostWallSelectOptions = activeOpening.hostWallId
    ? hostWallOptions
    : [{ label: 'Select derived wall', value: '' }, ...hostWallOptions.filter((option) => option.value !== '')];
  const selectedHostWallValue =
    activeOpening.hostWallId ?? (hostWallSelectOptions.some((option) => option.value === '') ? '' : hostWallSelectOptions[0]?.value ?? '');
  const activeOpeningTypeLabel =
    activeOpening.kind === 'slider'
      ? 'Slider'
      : activeOpening.kind === 'hinged_door'
        ? 'Hinged door'
        : activeOpening.kind === 'stacker'
          ? 'Stacker'
          : 'Window';

  sections.push(
    <div key="opening-trust" className={styles.inlineMeta}>
      <span className={styles.inlineLabel}>Trust</span>
      <span className={styles.inlineValue}>{activeOpening.trustLabel}</span>
    </div>,
    <p key="opening-selection-hint" className={styles.fieldHint}>
      Selected openings show width and along-wall offset dimensions in the Plan Editor. Drag the selected opening body there to reposition it along the resolved host wall. Height and base height stay editable in the rail for this slice.
    </p>,
    <TextField
      key="opening-label"
      label="Opening label"
      value={activeOpening.label}
      disabled={disabled}
      error={fieldErrors[`opening-label-${activeOpening.id}`]}
      onCommit={(value) =>
        runAction(
          `opening-label-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { label: value }),
          'Unable to rename the opening.',
        )
      }
    />,
    <SelectField
      key="opening-kind"
      label="Opening type"
      value={activeOpening.kind}
      options={[...OPENING_TYPE_OPTIONS]}
      disabled={disabled}
      error={fieldErrors[`opening-kind-${activeOpening.id}`]}
      helperText={`Current opening family: ${activeOpeningTypeLabel}.`}
      onCommit={(value) =>
        runAction(
          `opening-kind-${activeOpening.id}`,
          onCommitOpeningPatch?.(activeOpening.id, { kind: value as OpeningObjectModel['kind'] }),
          'Unable to update the opening type.',
        )
      }
    />,
    <SelectField
      key="opening-wall"
      label="Host wall"
      value={selectedHostWallValue}
      options={hostWallSelectOptions}
      disabled={disabled || !hostWallSelectOptions.length}
      error={fieldErrors[`opening-wall-${activeOpening.id}`]}
      helperText={
        activeOpening.hostWallOptions.length
          ? 'Openings host to derived walls from the current house envelope.'
          : 'Derived host walls are unavailable for this house right now.'
      }
      onCommit={(value) =>
        runAction(
          `opening-wall-${activeOpening.id}`,
          value
            ? onCommitOpeningPatch?.(activeOpening.id, { hostWallId: value })
            : { ok: false, error: 'Select a derived host wall first.' },
          'Unable to update the derived host wall.',
        )
      }
    />,
    ...(activeOpening.kind === 'slider'
      ? [
          <SelectField
            key="opening-panel-count"
            label="Panel count"
            value={String(activeOpening.panelCount ?? 2)}
            options={[...SLIDER_PANEL_COUNT_OPTIONS]}
            disabled={disabled}
            error={fieldErrors[`opening-panel-count-${activeOpening.id}`]}
            helperText="Simple panel count only for now. Leaf direction and stack behavior come later."
            onCommit={(value) =>
              runAction(
                `opening-panel-count-${activeOpening.id}`,
                onCommitOpeningPatch?.(activeOpening.id, {
                  panelCount: Number.parseInt(value, 10) as NonNullable<OpeningObjectModel['panelCount']>,
                }),
                'Unable to update the slider panel count.',
              )
            }
          />,
        ]
      : []),
    <NumberField
      key="opening-width"
      label="Opening width (m)"
      value={activeOpening.widthM}
      disabled={disabled}
      error={fieldErrors[`opening-width-${activeOpening.id}`]}
      onCommit={(value) =>
        runAction(
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
        runAction(
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
        runAction(
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
      helperText="Measured from the start of the resolved derived host wall."
      onCommit={(value) =>
        runAction(
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
          void runAction(
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
