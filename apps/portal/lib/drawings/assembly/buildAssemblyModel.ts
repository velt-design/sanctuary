import type { CostOutputV1 } from '@sp/costing';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { DrawingAssemblyFallVector, DrawingAssemblyModel } from './types';

function parseCount(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveFallVector(input: {
  attachmentSide: ModulePlanModel['attachmentSide'] | ModuleSectionModel['attachmentSide'];
  slopeDirection: ModulePlanModel['slopeDirection'] | ModuleSectionModel['slopeDirection'] | null;
}): DrawingAssemblyFallVector {
  const away = input.slopeDirection !== 'toward_house';
  if (input.attachmentSide === 'left') {
    return { x: away ? 1 : -1, y: 0, source: 'plan_local' };
  }
  if (input.attachmentSide === 'right') {
    return { x: away ? -1 : 1, y: 0, source: 'plan_local' };
  }
  if (input.attachmentSide === 'front') {
    return { x: 0, y: away ? -1 : 1, source: 'plan_local' };
  }
  return { x: 0, y: away ? 1 : -1, source: 'plan_local' };
}

export function buildAssemblyModel(input: {
  id: string;
  label: string;
  moduleIndex: number;
  moduleInput: CalculatorModuleInputs;
  moduleResult: CostOutputV1 | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
}): DrawingAssemblyModel {
  const planModel = input.planModel;
  const sectionModel = input.sectionModel;
  const attachmentSide = planModel?.attachmentSide ?? sectionModel?.attachmentSide ?? 'rear';
  const slopeDirection = planModel?.slopeDirection ?? sectionModel?.slopeDirection ?? null;
  const fallbackOverhangAmountM = Number.parseFloat(input.moduleInput.overhangAmountM ?? '0');
  const overhangAmountM = Number.isFinite(fallbackOverhangAmountM) ? fallbackOverhangAmountM : 0;

  return {
    id: input.id,
    label: input.label,
    moduleIndex: input.moduleIndex,
    moduleInput: input.moduleInput,
    moduleResult: input.moduleResult,
    planModel,
    sectionModel,
    roof: {
      pergolaStyle: input.moduleInput.pergolaStyle,
      roofType: planModel?.roofType ?? sectionModel?.roofType ?? null,
      sectionKind: sectionModel?.sectionKind ?? null,
      boxPerimeterEnabled: planModel?.boxPerimeterEnabled ?? sectionModel?.boxPerimeterEnabled ?? input.moduleInput.boxPerimeterEnabled,
      slopeDirection,
      fallVector: resolveFallVector({ attachmentSide, slopeDirection }),
      drawingRotationQuarterTurns: planModel?.drawingRotationQuarterTurns ?? 0,
      pitchDeg: sectionModel?.pitchDeg ?? null,
      overhangEnabled: planModel?.overhangEnabled ?? sectionModel?.overhangEnabled ?? input.moduleInput.overhangEnabled,
      overhangAmountM: planModel?.overhangAmountM ?? sectionModel?.overhangAmountM ?? overhangAmountM,
      footprint: {
        lengthA: planModel?.lengthA ?? null,
        spanA: planModel?.spanA ?? sectionModel?.spanA ?? null,
        lengthB: planModel?.lengthB ?? null,
        spanB: planModel?.spanB ?? sectionModel?.spanB ?? null,
      },
    },
    houseContext: {
      connectionType: planModel?.houseConnectionType ?? sectionModel?.houseConnectionType ?? input.moduleInput.houseConnectionType,
      attachmentSide,
      supportsFootprints: Boolean(planModel?.supportsHouseFootprints),
      footprintPreset: planModel?.houseFootprintPreset ?? null,
      footprintParams: planModel?.houseFootprintParams ?? null,
      attachmentEdgeLengthM: planModel?.attachmentEdgeLengthM ?? null,
      soffitBrackets: {
        offsetM: planModel?.soffitBracketOffsetM ?? null,
        maxSpacingM: planModel?.soffitBracketMaxSpacingM ?? null,
        positionsM: planModel?.soffitBracketPositionsA ?? [],
        count: planModel?.soffitBracketPositionsA.length ?? 0,
      },
    },
    structure: {
      posts: {
        count: parseCount(input.moduleInput.postCount),
        widthM: sectionModel?.postWidthM ?? null,
        depthM: sectionModel?.postDepthM ?? null,
      },
      rafters: {
        widthM: planModel?.rafterWidthM ?? sectionModel?.rafterWidthM ?? null,
        depthM: planModel?.rafterDepthM ?? sectionModel?.rafterDepthM ?? null,
        countA: planModel?.rafterCountA ?? null,
        spacingA: planModel?.rafterSpacingA ?? null,
        positionsA: planModel?.rafterPositionsA ?? [],
        edgeLengthA: planModel?.rafterEdgeLengthM ?? null,
        countB: planModel?.rafterCountB ?? null,
        spacingB: planModel?.rafterSpacingB ?? null,
        positionsB: planModel?.rafterPositionsB ?? [],
      },
      ledgerBeam: {
        widthM: planModel?.ledgerBeamWidthM ?? sectionModel?.ledgerBeamWidthM ?? null,
        depthM: planModel?.ledgerBeamDepthM ?? sectionModel?.ledgerBeamDepthM ?? null,
      },
      supportBeam: {
        widthM: planModel?.supportBeamWidthM ?? sectionModel?.supportBeamWidthM ?? null,
        depthM: planModel?.supportBeamDepthM ?? sectionModel?.supportBeamDepthM ?? null,
      },
      gutter: {
        widthM: planModel?.gutterWidthM ?? sectionModel?.gutterWidthM ?? null,
        depthM: planModel?.gutterDepthM ?? sectionModel?.gutterDepthM ?? null,
      },
      ridgeBeam: {
        widthM: planModel?.ridgeBeamWidthM ?? sectionModel?.ridgeBeamWidthM ?? null,
        depthM: planModel?.ridgeBeamDepthM ?? sectionModel?.ridgeBeamDepthM ?? null,
        present: Boolean(
          (planModel?.ridgeBeamWidthM ?? sectionModel?.ridgeBeamWidthM ?? 0) > 0 &&
            (planModel?.ridgeBeamDepthM ?? sectionModel?.ridgeBeamDepthM ?? 0) > 0,
        ),
      },
    },
    supportConditions: {
      postConnectionType: input.moduleInput.postConnectionType,
      houseConnectionType: input.moduleInput.houseConnectionType,
      ground: input.moduleInput.ground,
      postCount: parseCount(input.moduleInput.postCount),
    },
    capabilities: {
      hasPlan: Boolean(planModel),
      hasSection: Boolean(sectionModel),
      supportsHouseFootprints: Boolean(planModel?.supportsHouseFootprints),
      canEditHouseFootprint: Boolean(
        planModel &&
          planModel.houseConnectionType !== 'none' &&
          planModel.supportsHouseFootprints &&
          planModel.roofType !== 'hip_corner',
      ),
    },
  };
}
