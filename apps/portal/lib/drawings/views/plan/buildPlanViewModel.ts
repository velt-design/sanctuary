import type { DrawingAssemblyModel } from '@/lib/drawings/assembly/types';

export type PlanViewModel = {
  moduleId: string;
  moduleLabel: string;
  hasGeometry: boolean;
  roofType: DrawingAssemblyModel['roof']['roofType'];
  pergolaStyle: DrawingAssemblyModel['roof']['pergolaStyle'];
  rotationQuarterTurns: DrawingAssemblyModel['roof']['drawingRotationQuarterTurns'];
  primarySize: {
    lengthA: number | null;
    spanA: number | null;
    lengthB: number | null;
    spanB: number | null;
  };
  houseContext: {
    visible: boolean;
    attachmentSide: DrawingAssemblyModel['houseContext']['attachmentSide'];
    preset: DrawingAssemblyModel['houseContext']['footprintPreset'];
    supportsFootprints: boolean;
    editable: boolean;
  };
  structure: {
    rafterCountA: number | null;
    rafterSpacingA: number | null;
    hasRidgeBeam: boolean;
    soffitBracketCount: number;
  };
  annotations: {
    keepTextUpright: true;
    sheetPrimaryDimensionsPinned: 'left_bottom';
    suppressDocumentAnnotationsInModelSpace: true;
  };
  planModel: DrawingAssemblyModel['planModel'];
};

export function buildPlanViewModel(assembly: DrawingAssemblyModel | null): PlanViewModel | null {
  if (!assembly || !assembly.planModel) return null;

  return {
    moduleId: assembly.id,
    moduleLabel: assembly.label,
    hasGeometry: true,
    roofType: assembly.roof.roofType,
    pergolaStyle: assembly.roof.pergolaStyle,
    rotationQuarterTurns: assembly.roof.drawingRotationQuarterTurns,
    primarySize: {
      lengthA: assembly.roof.footprint.lengthA,
      spanA: assembly.roof.footprint.spanA,
      lengthB: assembly.roof.footprint.lengthB,
      spanB: assembly.roof.footprint.spanB,
    },
    houseContext: {
      visible: assembly.houseContext.connectionType !== 'none',
      attachmentSide: assembly.houseContext.attachmentSide,
      preset: assembly.houseContext.footprintPreset,
      supportsFootprints: assembly.houseContext.supportsFootprints,
      editable: assembly.capabilities.canEditHouseFootprint,
    },
    structure: {
      rafterCountA: assembly.structure.rafters.countA,
      rafterSpacingA: assembly.structure.rafters.spacingA,
      hasRidgeBeam: assembly.structure.ridgeBeam.present,
      soffitBracketCount: assembly.houseContext.soffitBrackets.count,
    },
    annotations: {
      keepTextUpright: true,
      sheetPrimaryDimensionsPinned: 'left_bottom',
      suppressDocumentAnnotationsInModelSpace: true,
    },
    planModel: assembly.planModel,
  };
}
