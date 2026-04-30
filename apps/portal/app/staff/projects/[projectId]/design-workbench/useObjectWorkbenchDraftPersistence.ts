'use client';

import { useCallback, useMemo } from 'react';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';
import {
  buildEstimateDrawingDraftFromSnapshot,
  estimateDrawingDraftMatchesSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildObjectWorkbenchCompatibilityProjectModel } from '@/lib/drawings/state/compat/objectWorkbenchCompatibilityModel';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
  buildObjectFirstWorkbenchProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import {
  normalizeObjectFirstWorkbenchDraftVNext,
  type ObjectFirstPergolaDraft,
  type ObjectFirstPergolaGeometryDraft,
  type ObjectFirstWorkbenchDraftVNext,
} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';

type UseObjectWorkbenchDraftPersistenceInput = {
  estimateId: string;
  snapshot: EstimateDetail['calculatorSnapshot'];
};

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasObjectFirstSignal(value: ObjectFirstWorkbenchDraftVNext): boolean {
  return Boolean(value.houseAssembly || value.decks.length || value.openings.length || value.pergolas.length);
}

function stringsMatch(left: string | null | undefined, right: string | number | null | undefined): boolean {
  return (left ?? '').trim() === String(right ?? '').trim();
}

function booleansMatch(left: boolean | null | undefined, right: boolean | null | undefined): boolean {
  return left === right;
}

function pruneEmptyObject<T extends object>(value: T | undefined): T | undefined {
  return value && Object.keys(value).length ? value : undefined;
}

function resolveSnapshotModuleForPergola(
  inputs: CalculatorInputs | null,
  pergola: ObjectFirstPergolaDraft,
): CalculatorModuleInputs | null {
  const modules = inputs?.modules ?? [];
  return (
    modules.find((module) => module.pergolaId === pergola.id) ??
    (modules.length === 1 ? modules[0] ?? null : null)
  );
}

function stripMirroredPergolaGeometry(
  pergola: ObjectFirstPergolaDraft,
  moduleInput: CalculatorModuleInputs | null,
): ObjectFirstPergolaDraft {
  if (!pergola.geometry || !moduleInput) return pergola;

  const dimensions: ObjectFirstPergolaGeometryDraft['dimensions'] = { ...(pergola.geometry.dimensions ?? {}) };
  if (stringsMatch(dimensions.lengthM, moduleInput.lengthM)) delete dimensions.lengthM;
  if (stringsMatch(dimensions.projectionM, moduleInput.projectionM)) delete dimensions.projectionM;
  if (stringsMatch(dimensions.hipCornerLengthBM, moduleInput.hipCornerLengthBM)) delete dimensions.hipCornerLengthBM;
  if (stringsMatch(dimensions.hipCornerProjectionBM, moduleInput.hipCornerProjectionBM)) delete dimensions.hipCornerProjectionBM;

  const roof: ObjectFirstPergolaGeometryDraft['roof'] = { ...(pergola.geometry.roof ?? {}) };
  if (roof.material === moduleInput.roofMaterial) delete roof.material;
  if (stringsMatch(roof.pitchDeg, moduleInput.roofPitchDeg)) delete roof.pitchDeg;
  if (booleansMatch(roof.boxPerimeterEnabled, moduleInput.boxPerimeterEnabled)) delete roof.boxPerimeterEnabled;
  if (stringsMatch(roof.mixedAcrylicBaysMain, moduleInput.mixedAcrylicBaysMain)) delete roof.mixedAcrylicBaysMain;
  if (stringsMatch(roof.mixedAcrylicBaysA, moduleInput.mixedAcrylicBaysA)) delete roof.mixedAcrylicBaysA;
  if (stringsMatch(roof.mixedAcrylicBaysB, moduleInput.mixedAcrylicBaysB)) delete roof.mixedAcrylicBaysB;

  const gable: ObjectFirstPergolaGeometryDraft['gable'] = { ...(pergola.geometry.gable ?? {}) };
  if (gable.endFramesMode === moduleInput.gableEndFramesMode) delete gable.endFramesMode;
  if (gable.houseEaveGutterMode === moduleInput.gableHouseEdgeGutter) delete gable.houseEaveGutterMode;
  if (gable.outerEaveGutterMode === moduleInput.gableOuterEdgeGutter) delete gable.outerEaveGutterMode;

  const supports: ObjectFirstPergolaGeometryDraft['supports'] = { ...(pergola.geometry.supports ?? {}) };
  if (supports.postConnectionType === moduleInput.postConnectionType) delete supports.postConnectionType;
  if (supports.ground === moduleInput.ground) delete supports.ground;
  if (stringsMatch(supports.postCount, moduleInput.postCount)) delete supports.postCount;
  if (stringsMatch(supports.postCutHeightM, moduleInput.postCutHeightM)) delete supports.postCutHeightM;

  const geometry: ObjectFirstPergolaGeometryDraft = {
    ...(pruneEmptyObject(dimensions) ? { dimensions: pruneEmptyObject(dimensions) } : null),
    ...(pruneEmptyObject(roof) ? { roof: pruneEmptyObject(roof) } : null),
    ...(pruneEmptyObject(gable) ? { gable: pruneEmptyObject(gable) } : null),
    ...(pruneEmptyObject(supports) ? { supports: pruneEmptyObject(supports) } : null),
    ...(pruneEmptyObject(pergola.geometry.overrides) ? { overrides: pergola.geometry.overrides } : null),
  };

  const nextPergola = { ...pergola };
  if (Object.keys(geometry).length) {
    nextPergola.geometry = geometry;
  } else {
    delete nextPergola.geometry;
  }
  return nextPergola;
}

function buildSnapshotObjectFirstBaseline(
  snapshot: EstimateDetail['calculatorSnapshot'],
  baseDraft: EstimateDrawingDraft | null,
): ObjectFirstWorkbenchDraftVNext | null {
  if (!baseDraft) return null;
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
    snapshot,
    draft: baseDraft,
  });
  return buildObjectFirstWorkbenchDraftFromProjectModel(
    buildObjectFirstWorkbenchProjectModel({
      compatibilityProjectModel,
    }),
  );
}

function objectFirstMatchesSnapshotBaseline(input: {
  objectFirst: EstimateDrawingDraft['objectFirst'];
  baselineObjectFirst: ObjectFirstWorkbenchDraftVNext | null;
  snapshotInputs: CalculatorInputs | null;
}): boolean {
  const normalizedObjectFirst = normalizeObjectFirstWorkbenchDraftVNext(input.objectFirst);
  if (!hasObjectFirstSignal(normalizedObjectFirst)) return true;
  if (!input.baselineObjectFirst) return false;

  const comparableObjectFirst = normalizeObjectFirstWorkbenchDraftVNext({
    ...normalizedObjectFirst,
    pergolas: normalizedObjectFirst.pergolas.map((pergola) =>
      stripMirroredPergolaGeometry(
        pergola,
        resolveSnapshotModuleForPergola(input.snapshotInputs, pergola),
      ),
    ),
  });
  const baselineObjectFirst = normalizeObjectFirstWorkbenchDraftVNext(input.baselineObjectFirst);
  const meaningfulDelta: ObjectFirstWorkbenchDraftVNext = {
    houseAssembly:
      comparableObjectFirst.houseAssembly && !jsonEqual(comparableObjectFirst.houseAssembly, baselineObjectFirst.houseAssembly)
        ? comparableObjectFirst.houseAssembly
        : null,
    decks:
      comparableObjectFirst.decks.length && !jsonEqual(comparableObjectFirst.decks, baselineObjectFirst.decks)
        ? comparableObjectFirst.decks
        : [],
    openings:
      comparableObjectFirst.openings.length && !jsonEqual(comparableObjectFirst.openings, baselineObjectFirst.openings)
        ? comparableObjectFirst.openings
        : [],
    pergolas:
      comparableObjectFirst.pergolas.length && !jsonEqual(comparableObjectFirst.pergolas, baselineObjectFirst.pergolas)
        ? comparableObjectFirst.pergolas
        : [],
  };

  return !hasObjectFirstSignal(meaningfulDelta);
}

function draftMatchesEffectiveSnapshot(input: {
  draft: EstimateDrawingDraft;
  snapshot: EstimateDetail['calculatorSnapshot'];
  baselineObjectFirst: ObjectFirstWorkbenchDraftVNext | null;
  snapshotInputs: CalculatorInputs | null;
}): boolean {
  const snapshotDraft = buildEstimateDrawingDraftFromSnapshot(input.snapshot);
  if (!snapshotDraft) return false;
  return (
    jsonEqual(input.draft.inputs, snapshotDraft.inputs) &&
    jsonEqual(input.draft.overrides, snapshotDraft.overrides) &&
    objectFirstMatchesSnapshotBaseline({
      objectFirst: input.draft.objectFirst,
      baselineObjectFirst: input.baselineObjectFirst,
      snapshotInputs: input.snapshotInputs,
    })
  );
}

export function useObjectWorkbenchDraftPersistence({
  estimateId,
  snapshot,
}: UseObjectWorkbenchDraftPersistenceInput) {
  const baseDraft = useMemo(() => buildEstimateDrawingDraftFromSnapshot(snapshot), [snapshot]);
  const baselineObjectFirst = useMemo(
    () => buildSnapshotObjectFirstBaseline(snapshot, baseDraft),
    [baseDraft, snapshot],
  );
  const snapshotInputs = baseDraft?.inputs ?? null;
  const drawingWorkingCopy = useLocalWorkingCopy<EstimateDrawingDraft | null>(
    buildEstimateDrawingDraftEntityKey(estimateId),
    baseDraft,
  );
  const drawingDraft = drawingWorkingCopy.value;

  const persistDrawingDraftLocally = useCallback(
    async (nextDraft: EstimateDrawingDraft) => {
      if (
        estimateDrawingDraftMatchesSnapshot(nextDraft, snapshot) ||
        draftMatchesEffectiveSnapshot({
          draft: nextDraft,
          snapshot,
          baselineObjectFirst,
          snapshotInputs,
        })
      ) {
        await drawingWorkingCopy.clearWorkingCopy();
      } else {
        await drawingWorkingCopy.setWorkingCopy(nextDraft);
      }
    },
    [baselineObjectFirst, drawingWorkingCopy, snapshot, snapshotInputs],
  );

  return {
    drawingDraft,
    persistDrawingDraftLocally,
  };
}
