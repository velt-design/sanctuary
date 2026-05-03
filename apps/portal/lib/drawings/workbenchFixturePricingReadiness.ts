import { compareCommercialDesignInputsV1, type CommercialParityReportV1 } from '@sp/costing';
import type { CalculatorInputs } from '@/lib/types/calculator';
import { buildCommercialDesignInputFromCalculatorInputs } from '@/lib/estimates/commercialDesignPayload';
import {
  evaluateWorkbenchSolvedPricingReadiness,
  type EstimateWorkbenchSolvedReadinessReport,
} from '@/lib/estimates/pricingRollout';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';
import { buildCommercialDesignInputFromWorkbenchSolvedModel } from './commercialDesignPayload';
import { buildWorkbenchSolvedModel } from './state/workbenchSolvedModel';

type FixtureCalculatorSnapshot = {
  inputs: CalculatorInputs;
  outputs?: Parameters<typeof buildCommercialDesignInputFromCalculatorInputs>[0]['siteResult'];
};

export type WorkbenchFixturePricingReadiness = {
  source: 'workbench_solved';
  trustStatus: string;
  readiness: 'eligible' | 'blocked';
  blockingGateCodes: string[];
  quantityTakeoffSource: 'solved_geometry_spine';
  parity: {
    status: CommercialParityReportV1['status'];
    pergolasCompared: number;
    modulesCompared: number;
    differences: number;
    blockingDifferences: number;
    warningDifferences: number;
  };
  readinessReport: EstimateWorkbenchSolvedReadinessReport;
};

function cloneFixtureCalculatorSnapshot(fixture: SanctuaryGeometryWorkbenchFixture): FixtureCalculatorSnapshot {
  const snapshot = structuredClone(fixture.snapshot) as Partial<FixtureCalculatorSnapshot>;
  if (!snapshot.inputs || !Array.isArray(snapshot.inputs.modules)) {
    throw new Error(`Workbench fixture ${fixture.slug} is missing calculator inputs.`);
  }
  return {
    inputs: snapshot.inputs,
    outputs: snapshot.outputs ?? null,
  };
}

function parityReportForReadiness(report: CommercialParityReportV1): CommercialParityReportV1 {
  if (report.counts.blockingDifferences > 0) return report;
  return {
    ...report,
    status: 'match',
  };
}

export function buildWorkbenchFixturePricingReadiness(
  fixture: SanctuaryGeometryWorkbenchFixture,
  input?: { projectId?: string },
): WorkbenchFixturePricingReadiness {
  const snapshot = cloneFixtureCalculatorSnapshot(fixture);
  const identity = {
    projectId: input?.projectId ?? `fixture-${fixture.slug}`,
    estimateId: fixture.estimate.id,
    designRequestId: fixture.request.id,
  };
  const calculatorCommercialInput = buildCommercialDesignInputFromCalculatorInputs({
    inputs: snapshot.inputs,
    siteResult: snapshot.outputs,
    identity,
  });
  const solvedModel = buildWorkbenchSolvedModel({
    snapshot: fixture.snapshot,
    draft: fixture.draft,
    moduleLabels: fixture.moduleLabels,
    geometryIdentity: identity,
  });
  const workbenchCommercialInput = buildCommercialDesignInputFromWorkbenchSolvedModel({
    solvedModel,
    siteCommercial: calculatorCommercialInput.siteCommercial,
  });
  const parityReport = compareCommercialDesignInputsV1(calculatorCommercialInput, workbenchCommercialInput, {
    labelLeft: `${fixture.slug}:calculator_compat`,
    labelRight: `${fixture.slug}:workbench_solved`,
  });
  const readinessReport = evaluateWorkbenchSolvedPricingReadiness({
    workbenchCommercialInput,
    quantityTakeoffSource: 'solved_geometry_spine',
    parityReports: [parityReportForReadiness(parityReport)],
    estimatePersistenceSourceRecorded: true,
    estimateLockBoundaryPreserved: true,
    localFirstBoundaryPreserved: true,
    downstreamPricingBoundaryPreserved: true,
    rollbackToCalculatorLiveConfirmed: true,
  });

  return {
    source: workbenchCommercialInput.source,
    trustStatus: workbenchCommercialInput.trustStatus,
    readiness: readinessReport.eligibleToEnable ? 'eligible' : 'blocked',
    blockingGateCodes: readinessReport.blockingGateCodes,
    quantityTakeoffSource: 'solved_geometry_spine',
    parity: {
      status: parityReport.status,
      pergolasCompared: parityReport.counts.pergolasCompared,
      modulesCompared: parityReport.counts.modulesCompared,
      differences: parityReport.counts.differences,
      blockingDifferences: parityReport.counts.blockingDifferences,
      warningDifferences: parityReport.counts.warningDifferences,
    },
    readinessReport,
  };
}
