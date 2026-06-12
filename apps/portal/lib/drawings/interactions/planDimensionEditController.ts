import type { AttachmentSide } from '@sp/geometry';
import type { EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchOpeningPatch,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type {
  CalculatorHouseFootprintParams,
  CalculatorHouseFootprintPolygonPoint,
} from '@/lib/types/calculator';
import {
  resizeObjectWorkbenchCustomPolygonEdge,
  type ObjectWorkbenchPlanCustomEdgeCandidate,
  type ObjectWorkbenchPlanDeckReferenceFrame,
  type ObjectWorkbenchPlanPresetDimensionAnnotation,
  type PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';

export type PlanDimensionEditAnnotation =
  | ObjectWorkbenchPlanPresetDimensionAnnotation
  | ObjectWorkbenchPlanCustomEdgeCandidate;

export type PlanDimensionEditCommitIntent =
  | {
      kind: 'house_footprint_edit';
      edit: EstimateDrawingFootprintEdit;
      diagnostics: PlanDimensionEditDiagnostics;
    }
  | {
      kind: 'deck_patch';
      deckId: string;
      patch: ObjectWorkbenchDeckPatch;
      diagnostics: PlanDimensionEditDiagnostics;
    }
  | {
      kind: 'opening_patch';
      openingId: string;
      patch: ObjectWorkbenchOpeningPatch;
      diagnostics: PlanDimensionEditDiagnostics;
    }
  | {
      kind: 'invalid' | 'unsupported';
      error: string;
      diagnostics: PlanDimensionEditDiagnostics;
    };

export type PlanDimensionEditDiagnostics = {
  targetKind: PlanDimensionEditAnnotation['targetKind'];
  ownerKind: PlanDimensionEditAnnotation['ownerKind'];
  ownerId: string;
  fieldKey: string | null;
  commitIntent: PlanDimensionEditCommitIntent['kind'] | 'pending';
};

export type ResolvePlanDimensionEditIntentInput = {
  annotation: PlanDimensionEditAnnotation;
  nextValue: string;
  customDeckLocalPolygon?: CalculatorHouseFootprintPolygonPoint[] | null;
};

function formatDeckPresetValue(value: number): string {
  return value.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function findDeckReferenceFrameById(
  frames: readonly ObjectWorkbenchPlanDeckReferenceFrame[],
  edgeId: string | null | undefined,
): ObjectWorkbenchPlanDeckReferenceFrame | null {
  if (!edgeId) return null;
  return frames.find((frame) => frame.sourceEdgeId === edgeId) ?? null;
}

function buildDiagnostics(
  annotation: PlanDimensionEditAnnotation,
  commitIntent: PlanDimensionEditDiagnostics['commitIntent'],
): PlanDimensionEditDiagnostics {
  return {
    targetKind: annotation.targetKind,
    ownerKind: annotation.ownerKind,
    ownerId: annotation.ownerId,
    fieldKey: 'fieldKey' in annotation ? annotation.fieldKey : null,
    commitIntent,
  };
}

function invalidIntent(
  annotation: PlanDimensionEditAnnotation,
  error: string,
  kind: 'invalid' | 'unsupported' = 'invalid',
): PlanDimensionEditCommitIntent {
  return {
    kind,
    error,
    diagnostics: buildDiagnostics(annotation, kind),
  };
}

function resolveDeckHostReferenceCenterOffset(input: {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation;
  nextValue: string;
}): { ok: true; centerOffsetM: string } | { ok: false; error: string } {
  const interaction = input.annotation.deckInteraction;
  const nextGapM = Number.parseFloat(input.nextValue);
  if (!interaction) return { ok: false, error: 'Deck relationship metadata is unavailable.' };
  if (!Number.isFinite(nextGapM) || nextGapM < 0) return { ok: false, error: 'Enter a non-negative offset.' };

  const maxGapM = Math.max(0, interaction.hostSpanM - interaction.deckWidthM);
  if (nextGapM > maxGapM + 1e-6) {
    return { ok: false, error: 'Offset must stay within the host edge span.' };
  }

  const availableHalfSpanM = Math.max(0, (interaction.hostSpanM - interaction.deckWidthM) / 2);
  const centerOffsetM =
    input.annotation.fieldKey === 'hostStartGapM'
      ? nextGapM - availableHalfSpanM
      : input.annotation.fieldKey === 'hostEndGapM'
        ? availableHalfSpanM - nextGapM
        : Number.NaN;

  if (!Number.isFinite(centerOffsetM)) {
    return { ok: false, error: 'Unsupported deck relationship dimension.' };
  }

  return {
    ok: true,
    centerOffsetM: formatDeckPresetValue(clampValue(centerOffsetM, interaction.minCenterOffsetM, interaction.maxCenterOffsetM)),
  };
}

function resolveDeckCrossEdgeCenterOffset(input: {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation;
  nextValue: string;
}): { ok: true; centerOffsetM: string } | { ok: false; error: string } {
  const interaction = input.annotation.deckInteraction;
  const nextGapM = Number.parseFloat(input.nextValue);
  if (!interaction?.crossEdgeReference) return { ok: false, error: 'Deck witness metadata is unavailable.' };
  if (!Number.isFinite(nextGapM) || nextGapM < 0) return { ok: false, error: 'Enter a non-negative gap.' };

  const primaryFrame = interaction.placementEdgeId
    ? interaction.referenceFrames.find((frame) => frame.sourceEdgeId === interaction.placementEdgeId)
    : interaction.referenceFrames.find((frame) => frame.sourceEdgeId === interaction.witnessEdgeId);
  if (!primaryFrame) return { ok: false, error: 'Deck host metadata is unavailable.' };

  const crossFrame = interaction.crossEdgeReference.frame;
  const deckWidthM = interaction.deckWidthM;
  let centerAlongM: number;

  if (crossFrame.hostEdgeId === 'left') {
    centerAlongM = crossFrame.edgeCoordinateM - nextGapM - deckWidthM / 2;
  } else if (crossFrame.hostEdgeId === 'right') {
    centerAlongM = crossFrame.edgeCoordinateM + nextGapM + deckWidthM / 2;
  } else if (crossFrame.hostEdgeId === 'rear') {
    centerAlongM = crossFrame.edgeCoordinateM - nextGapM - deckWidthM / 2;
  } else {
    centerAlongM = crossFrame.edgeCoordinateM + nextGapM + deckWidthM / 2;
  }

  const hostMidpointM = (primaryFrame.spanStartM + primaryFrame.spanEndM) / 2;
  return {
    ok: true,
    centerOffsetM: formatDeckPresetValue(centerAlongM - hostMidpointM),
  };
}

function translateDeckOutlineByPlanDelta(input: {
  polygon: CalculatorHouseFootprintPolygonPoint[];
  attachmentSide: AttachmentSide;
  deltaX: number;
  deltaY: number;
}): CalculatorHouseFootprintPolygonPoint[] {
  void input.attachmentSide;
  return input.polygon.map((point) => {
    const alongM = Number(point.alongM);
    const depthM = Number(point.depthM);
    return {
      alongM: formatDeckPresetValue(alongM + input.deltaX),
      depthM: formatDeckPresetValue(depthM + input.deltaY),
    };
  });
}

function buildFloatingRectFromPlanCenter(input: {
  center: PlanPoint;
  attachmentSide: AttachmentSide;
  widthM: number;
  depthM: number;
}): NonNullable<ObjectWorkbenchDeckPatch['floatingRect']> | null {
  void input.attachmentSide;
  if (!Number.isFinite(input.widthM) || !Number.isFinite(input.depthM)) return null;
  return {
    centerAlongM: formatDeckPresetValue(input.center.x),
    centerDepthM: formatDeckPresetValue(input.center.y),
    widthM: formatDeckPresetValue(input.widthM),
    depthM: formatDeckPresetValue(input.depthM),
  };
}

function resolveCustomDeckRelationshipPatch(input: {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation;
  nextValue: string;
  customDeckLocalPolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
}):
  | { ok: true; patch: ObjectWorkbenchDeckPatch }
  | { ok: false; error: string } {
  const interaction = input.annotation.deckInteraction;
  if (!interaction) return { ok: false, error: 'Deck relationship metadata is unavailable.' };
  if (!input.customDeckLocalPolygon) return { ok: false, error: 'Deck outline metadata is unavailable.' };

  if (input.annotation.fieldKey === 'hostStartGapM' || input.annotation.fieldKey === 'hostEndGapM') {
    return { ok: false, error: 'Custom deck host-span dimensions are not editable in this view.' };
  }

  if (input.annotation.fieldKey === 'referenceEdgeGapM') {
    const nextGapM = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(nextGapM) || nextGapM < 0) {
      return { ok: false, error: 'Enter a non-negative gap.' };
    }
    const primaryFrame = findDeckReferenceFrameById(interaction.referenceFrames, interaction.witnessEdgeId);
    if (!primaryFrame) return { ok: false, error: 'Deck host metadata is unavailable.' };
    const deltaGapM = nextGapM - interaction.referenceEdgeGapM;
    return {
      ok: true,
      patch: {
        hostEdgeId: interaction.witnessEdgeId ?? null,
        isAttached: false,
        outline: translateDeckOutlineByPlanDelta({
          polygon: input.customDeckLocalPolygon,
          attachmentSide: interaction.houseAttachmentSide,
          deltaX: primaryFrame.outwardUnitX * deltaGapM,
          deltaY: primaryFrame.outwardUnitY * deltaGapM,
        }),
      },
    };
  }

  if (input.annotation.fieldKey === 'crossEdgeGapM') {
    const nextGapM = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(nextGapM) || nextGapM < 0) {
      return { ok: false, error: 'Enter a non-negative gap.' };
    }
    const crossFrame = interaction.crossEdgeReference?.frame;
    if (!crossFrame) return { ok: false, error: 'Deck witness metadata is unavailable.' };
    const currentGapM = Number.parseFloat(input.annotation.rawValue);
    const deltaGapM = nextGapM - (Number.isFinite(currentGapM) ? currentGapM : 0);
    return {
      ok: true,
      patch: {
        hostEdgeId: interaction.witnessEdgeId ?? null,
        isAttached: false,
        outline: translateDeckOutlineByPlanDelta({
          polygon: input.customDeckLocalPolygon,
          attachmentSide: interaction.houseAttachmentSide,
          deltaX: crossFrame.outwardUnitX * deltaGapM,
          deltaY: crossFrame.outwardUnitY * deltaGapM,
        }),
      },
    };
  }

  return { ok: false, error: 'Unsupported deck relationship dimension.' };
}

function resolveFloatingRelationshipPatch(input: {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation;
  nextValue: string;
}):
  | { ok: true; floatingRect: NonNullable<ObjectWorkbenchDeckPatch['floatingRect']> }
  | { ok: false; error: string }
  | null {
  const interaction = input.annotation.deckInteraction;
  if (!interaction || interaction.placement !== 'floating') return null;
  if (interaction.kind === 'custom_outline') return null;

  if (input.annotation.fieldKey === 'referenceEdgeGapM') {
    const nextGapM = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(nextGapM) || nextGapM < 0) {
      return { ok: false, error: 'Enter a non-negative gap.' };
    }
    const primaryFrame = findDeckReferenceFrameById(interaction.referenceFrames, interaction.witnessEdgeId);
    if (!primaryFrame) return { ok: false, error: 'Deck host metadata is unavailable.' };
    const deltaGapM = nextGapM - interaction.referenceEdgeGapM;
    const nextCenter = {
      x: interaction.renderedCenter.x + primaryFrame.outwardUnitX * deltaGapM,
      y: interaction.renderedCenter.y + primaryFrame.outwardUnitY * deltaGapM,
    };
    const floatingRect = buildFloatingRectFromPlanCenter({
      center: nextCenter,
      attachmentSide: interaction.houseAttachmentSide,
      widthM: interaction.deckWidthM,
      depthM: interaction.deckDepthM,
    });
    if (!floatingRect) return { ok: false, error: 'Unable to update the floating deck position.' };
    return { ok: true, floatingRect };
  }

  if (input.annotation.fieldKey === 'crossEdgeGapM') {
    const nextGapM = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(nextGapM) || nextGapM < 0) {
      return { ok: false, error: 'Enter a non-negative gap.' };
    }
    const crossFrame = interaction.crossEdgeReference?.frame;
    if (!crossFrame) return { ok: false, error: 'Deck witness metadata is unavailable.' };
    const currentGapM = Number.parseFloat(input.annotation.rawValue);
    const deltaGapM = nextGapM - (Number.isFinite(currentGapM) ? currentGapM : 0);
    const nextCenter = {
      x: interaction.renderedCenter.x + crossFrame.outwardUnitX * deltaGapM,
      y: interaction.renderedCenter.y + crossFrame.outwardUnitY * deltaGapM,
    };
    const floatingRect = buildFloatingRectFromPlanCenter({
      center: nextCenter,
      attachmentSide: interaction.houseAttachmentSide,
      widthM: interaction.deckWidthM,
      depthM: interaction.deckDepthM,
    });
    if (!floatingRect) return { ok: false, error: 'Unable to update the floating deck position.' };
    return { ok: true, floatingRect };
  }

  return null;
}

function resolveDeckRelationshipPatch(input: {
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation;
  nextValue: string;
  customDeckLocalPolygon: CalculatorHouseFootprintPolygonPoint[] | null | undefined;
}): PlanDimensionEditCommitIntent {
  const annotation = input.annotation;
  const interaction = annotation.deckInteraction;

  if (interaction?.kind === 'custom_outline') {
    const customPatch = resolveCustomDeckRelationshipPatch({
      annotation,
      nextValue: input.nextValue,
      customDeckLocalPolygon: input.customDeckLocalPolygon,
    });
    return customPatch.ok
      ? {
          kind: 'deck_patch',
          deckId: annotation.ownerId,
          patch: customPatch.patch,
          diagnostics: buildDiagnostics(annotation, 'deck_patch'),
        }
      : invalidIntent(annotation, customPatch.error);
  }

  const floatingRelationshipPatch = resolveFloatingRelationshipPatch({
    annotation,
    nextValue: input.nextValue,
  });
  const resolvedRelationship =
    annotation.fieldKey === 'hostStartGapM' || annotation.fieldKey === 'hostEndGapM'
      ? resolveDeckHostReferenceCenterOffset({
          annotation,
          nextValue: input.nextValue,
        })
      : annotation.fieldKey === 'crossEdgeGapM'
        ? resolveDeckCrossEdgeCenterOffset({
            annotation,
            nextValue: input.nextValue,
          })
        : annotation.fieldKey === 'referenceEdgeGapM'
          ? { ok: true as const, centerOffsetM: '' }
          : { ok: false as const, error: 'Unsupported deck relationship dimension.' };

  if (floatingRelationshipPatch && !floatingRelationshipPatch.ok) {
    return invalidIntent(annotation, floatingRelationshipPatch.error);
  }
  if (!resolvedRelationship.ok) {
    return invalidIntent(annotation, resolvedRelationship.error);
  }

  const floatingRect =
    floatingRelationshipPatch && 'floatingRect' in floatingRelationshipPatch
      ? floatingRelationshipPatch.floatingRect
      : null;
  const patch: ObjectWorkbenchDeckPatch =
    annotation.fieldKey === 'referenceEdgeGapM'
      ? {
          isAttached: false,
          presetType: 'rect_detached',
          ...(floatingRect ? { floatingRect } : null),
          presetRect: {
            detachedGapM: input.nextValue,
          } as NonNullable<ObjectWorkbenchDeckPatch['presetRect']>,
        }
      : {
          ...(floatingRect ? { floatingRect } : null),
          presetRect: {
            centerOffsetM: resolvedRelationship.centerOffsetM,
          } as NonNullable<ObjectWorkbenchDeckPatch['presetRect']>,
        };

  return {
    kind: 'deck_patch',
    deckId: annotation.ownerId,
    patch,
    diagnostics: buildDiagnostics(annotation, 'deck_patch'),
  };
}

export function resolvePlanDimensionEditIntent(
  input: ResolvePlanDimensionEditIntentInput,
): PlanDimensionEditCommitIntent {
  const nextValue = input.nextValue.trim();
  const annotation = input.annotation;

  if (annotation.targetKind === 'house_preset_param') {
    return {
      kind: 'house_footprint_edit',
      edit: {
        type: 'param',
        key: annotation.fieldKey as keyof CalculatorHouseFootprintParams,
        value: nextValue,
      },
      diagnostics: buildDiagnostics(annotation, 'house_footprint_edit'),
    };
  }

  if (annotation.targetKind === 'house_custom_edge') {
    const polygon = resizeObjectWorkbenchCustomPolygonEdge({
      polygon: annotation.localPolygon,
      edgeIndex: annotation.edgeIndex,
      nextLengthM: nextValue,
    });
    return polygon
      ? {
          kind: 'house_footprint_edit',
          edit: { type: 'polygon', polygon },
          diagnostics: buildDiagnostics(annotation, 'house_footprint_edit'),
        }
      : invalidIntent(annotation, 'Enter a positive edge length.');
  }

  if (annotation.targetKind === 'deck_preset_param') {
    const floatingRectPatch =
      annotation.deckInteraction?.placement === 'floating' &&
      (annotation.fieldKey === 'widthM' || annotation.fieldKey === 'depthM')
        ? buildFloatingRectFromPlanCenter({
            center: annotation.deckInteraction.renderedCenter,
            attachmentSide: annotation.deckInteraction.houseAttachmentSide,
            widthM:
              annotation.fieldKey === 'widthM'
                ? Number.parseFloat(nextValue)
                : annotation.deckInteraction.deckWidthM,
            depthM:
              annotation.fieldKey === 'depthM'
                ? Number.parseFloat(nextValue)
                : annotation.deckInteraction.deckDepthM,
          })
        : null;
    return {
      kind: 'deck_patch',
      deckId: annotation.ownerId,
      patch: {
        ...(floatingRectPatch ? { floatingRect: floatingRectPatch } : null),
        presetRect: {
          [annotation.fieldKey]: nextValue,
        } as NonNullable<ObjectWorkbenchDeckPatch['presetRect']>,
      },
      diagnostics: buildDiagnostics(annotation, 'deck_patch'),
    };
  }

  if (annotation.targetKind === 'deck_custom_edge') {
    const polygon = resizeObjectWorkbenchCustomPolygonEdge({
      polygon: annotation.localPolygon,
      edgeIndex: annotation.edgeIndex,
      nextLengthM: nextValue,
    });
    return polygon
      ? {
          kind: 'deck_patch',
          deckId: annotation.ownerId,
          patch: {
            shape: 'custom',
            outline: polygon,
          },
          diagnostics: buildDiagnostics(annotation, 'deck_patch'),
        }
      : invalidIntent(annotation, 'Enter a positive edge length.');
  }

  if (annotation.targetKind === 'deck_host_edge_reference') {
    return resolveDeckRelationshipPatch({
      annotation,
      nextValue,
      customDeckLocalPolygon: input.customDeckLocalPolygon,
    });
  }

  if (annotation.targetKind === 'opening_param') {
    return {
      kind: 'opening_patch',
      openingId: annotation.ownerId,
      patch: {
        [annotation.fieldKey]: nextValue,
      } as ObjectWorkbenchOpeningPatch,
      diagnostics: buildDiagnostics(annotation, 'opening_patch'),
    };
  }

  return invalidIntent(annotation, 'Unsupported dimension target.', 'unsupported');
}
