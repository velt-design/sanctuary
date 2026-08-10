import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  clampInt,
  computeBayCountsForModule,
  computeHasOurGutter,
  getRoofTypeForModule,
  normalizeFlashingsStateForUi,
  toNonNegativeInt,
  toNumber,
} from './calculatorInputs';

type CalculatorModuleErrors = Partial<Record<keyof CalculatorModuleInputs, string>>;

export function buildCalculatorModuleErrors(
  modules: readonly CalculatorModuleInputs[],
): CalculatorModuleErrors[] {
  return modules.map((module) => {
    const next: CalculatorModuleErrors = {};
    const isOpenPergola = module.roofMaterial === 'none';

    const length = toNumber(module.lengthM);
    if (!Number.isFinite(length) || length <= 0) next.lengthM = 'Enter a length > 0';

    const projection = toNumber(module.projectionM);
    if (!Number.isFinite(projection) || projection <= 0) next.projectionM = 'Enter a roof span > 0';

    if (module.pergolaStyle === 'hip_corner') {
      const lengthB = toNumber(module.hipCornerLengthBM);
      if (!Number.isFinite(lengthB) || lengthB <= 0) next.hipCornerLengthBM = 'Roof length B is required';

      const projectionB = toNumber(module.hipCornerProjectionBM);
      if (!Number.isFinite(projectionB) || projectionB <= 0) next.hipCornerProjectionBM = 'Roof span B is required';
    }

    const postHeight = toNumber(module.postCutHeightM);
    if (!Number.isFinite(postHeight) || postHeight <= 0) next.postCutHeightM = 'Enter a post cut height > 0';

    if (!isOpenPergola && module.roofPitchDeg.trim()) {
      const pitch = toNumber(module.roofPitchDeg);
      if (!Number.isFinite(pitch) || pitch < 0 || pitch > 85) next.roofPitchDeg = 'Enter a pitch between 0 and 85';
    }

    const roofTypeForModule = getRoofTypeForModule(module);
    if (!isOpenPergola && module.overhangEnabled && module.boxPerimeterEnabled) {
      next.overhangEnabled = 'Overhang cannot be used with Box Perimeter.';
    }
    if (!isOpenPergola && module.invertedEnabled && (roofTypeForModule !== 'pitched' || module.boxPerimeterEnabled)) {
      next.invertedEnabled = 'Inverted option is only available for Pitched roofs.';
    }
    if (!isOpenPergola && module.overhangEnabled) {
      const overhangAmount = toNumber(module.overhangAmountM);
      if (!Number.isFinite(overhangAmount) || overhangAmount < 0 || overhangAmount > 1.5) {
        next.overhangAmountM = 'Enter an overhang between 0 and 1.5m';
      } else {
        const span = toNumber(module.projectionM);
        if (Number.isFinite(span) && overhangAmount >= span) {
          next.overhangAmountM = `Overhang must be less than roof span (${span}m)`;
        }
      }
    }

    const postCount = toNumber(module.postCount);
    if (!Number.isFinite(postCount) || postCount <= 0) next.postCount = 'Enter a post count > 0';

    const downpipeCount = toNumber(module.downpipeCount);
    if (!isOpenPergola && module.downpipeCount.trim()) {
      if (!Number.isFinite(downpipeCount) || downpipeCount < 0) next.downpipeCount = 'Enter a downpipe count >= 0';
    }

    const downpipeJoinCount = toNonNegativeInt(module.downpipeJoinCount);
    if (!isOpenPergola && (!Number.isFinite(downpipeJoinCount) || downpipeJoinCount < 0 || downpipeJoinCount > 10)) {
      next.downpipeJoinCount = 'Choose 0–10';
    }

    if (computeHasOurGutter(module)) {
      const downpipeElbowCount = toNonNegativeInt(module.downpipeElbowCount);
      if (!Number.isFinite(downpipeElbowCount) || downpipeElbowCount < 0 || downpipeElbowCount > 20) {
        next.downpipeElbowCount = 'Choose 0–20';
      }
    }

    if (isOpenPergola) {
      const rafterSpacingMm = toNumber(module.rafterSpacingMm ?? '500');
      if (!Number.isFinite(rafterSpacingMm) || rafterSpacingMm <= 0) {
        next.rafterSpacingMm = 'Enter a rafter spacing > 0';
      }
    }

    if (module.extrusionColour === 'Mill') {
      if (module.powdercoatIsCustom) {
        if (!module.powdercoatCustomColour?.trim()) next.powdercoatCustomColour = 'Enter a custom powdercoat colour';
      } else if (!module.powdercoatStandardColour?.trim()) {
        next.powdercoatStandardColour = 'Select a powdercoat colour';
      }
    }

    if (module.roofMaterial === 'mixed') {
      const bayCounts = computeBayCountsForModule(module);
      if (bayCounts.roofType === 'pitched') {
        const raw = toNonNegativeInt(module.mixedAcrylicBaysMain);
        const clamped = clampInt(raw, 0, bayCounts.bayCountMain);
        if (!Number.isFinite(raw) || clamped !== raw) {
          next.mixedAcrylicBaysMain = `Enter an integer between 0 and ${bayCounts.bayCountMain}`;
        }
      } else if (bayCounts.roofType === 'hip_corner') {
        const rawA = toNonNegativeInt(module.mixedAcrylicBaysA);
        const rawB = toNonNegativeInt(module.mixedAcrylicBaysB);
        const clampedA = clampInt(rawA, 0, bayCounts.bayCountA);
        const clampedB = clampInt(rawB, 0, bayCounts.bayCountB);
        if (!Number.isFinite(rawA) || clampedA !== rawA) {
          next.mixedAcrylicBaysA = `Enter an integer between 0 and ${bayCounts.bayCountA}`;
        }
        if (!Number.isFinite(rawB) || clampedB !== rawB) {
          next.mixedAcrylicBaysB = `Enter an integer between 0 and ${bayCounts.bayCountB}`;
        }
      } else {
        const rawA = toNonNegativeInt(module.mixedAcrylicBaysA);
        const rawB = toNonNegativeInt(module.mixedAcrylicBaysB);
        const clampedA = clampInt(rawA, 0, bayCounts.bayCountA);
        const clampedB = clampInt(rawB, 0, bayCounts.bayCountB);
        if (!Number.isFinite(rawA) || clampedA !== rawA) {
          next.mixedAcrylicBaysA = `Enter an integer between 0 and ${bayCounts.bayCountA}`;
        }
        if (!Number.isFinite(rawB) || clampedB !== rawB) {
          next.mixedAcrylicBaysB = `Enter an integer between 0 and ${bayCounts.bayCountB}`;
        }
      }
    }

    if (module.roofMaterial === 'timber' || module.roofMaterial === 'mixed') {
      if (!['insulated_panels', 'steel_corrugated', 'steel_tray'].includes(module.timberRoofAboveType)) {
        next.timberRoofAboveType = 'Select a timber roof above type';
      }
      if (module.timberRoofAboveType === 'insulated_panels') {
        const thickness = toNumber(module.timberInsulatedPanelThicknessMm);
        if (!Number.isFinite(thickness) || thickness <= 0) {
          next.timberInsulatedPanelThicknessMm = 'Enter a panel thickness > 0';
        }
      }
      if (module.timberRoofAboveType === 'steel_tray') {
        const trayWidth = toNumber(module.timberTrayWidthMm);
        if (![400, 500, 600].includes(Number.isFinite(trayWidth) ? Math.round(trayWidth) : NaN)) {
          next.timberTrayWidthMm = 'Choose 400, 500, or 600';
        }
      }
    }

    if (!isOpenPergola) {
      const flashings = normalizeFlashingsStateForUi(module.flashings, module);
      const hasInvalidLength = flashings.rows.some((row) => {
        const length = toNumber(row.lengthM);
        return !Number.isFinite(length) || length < 0;
      });
      if (hasInvalidLength) next.flashings = 'Enter a flashing length of 0 or more.';
    }

    return next;
  });
}
