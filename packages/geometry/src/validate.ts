import type { GeometryConfig, GeometryValidationReport } from './contracts';
import { getGeometryFixtureCase } from './fixtures';
import type { SolveAssembly3DResult } from './solve.types';
import { canonicalizeAssembly3D, diffCanonicalAssembly } from './validation/canonical';
import { runGeometryInvariants } from './validation/invariants';

type ValidateGeometrySolveInput = {
  config: GeometryConfig;
  solveResult: SolveAssembly3DResult;
  fixtureId?: string | null;
};

function summarizeDiffs(paths: string[]): string {
  if (paths.length === 0) return 'fixture matches';
  if (paths.length === 1) return `fixture drift at ${paths[0]}`;
  return `fixture drift at ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ` (+${paths.length - 3} more)` : ''}`;
}

export function validateGeometrySolve(input: ValidateGeometrySolveInput): GeometryValidationReport {
  const fixture = input.fixtureId ? getGeometryFixtureCase(input.fixtureId) : null;

  if (!input.solveResult.ok) {
    const fixtureComparisons =
      fixture === null
        ? []
        : fixture.kind === 'unsupported' &&
            fixture.expectedErrorCode === input.solveResult.code &&
            input.solveResult.error.includes(fixture.expectedMessageIncludes)
          ? [
              {
                fixtureId: fixture.id,
                status: 'match' as const,
                message: 'Unsupported fixture rejection matches the expected solver boundary.',
              },
            ]
          : [
              {
                fixtureId: fixture.id,
                status: 'drift' as const,
                message: 'Unsupported fixture rejection does not match the expected solver boundary.',
              },
            ];

    return {
      status: 'unsupported',
      invariants: [],
      unsupportedReasons: [input.solveResult.error],
      fixtureComparisons,
    };
  }

  const invariants = runGeometryInvariants(input.config, input.solveResult.value);
  const fixtureComparisons =
    fixture === null
      ? []
      : fixture.kind === 'supported'
        ? (() => {
            const actual = canonicalizeAssembly3D(input.solveResult.value);
            const diffs = diffCanonicalAssembly(actual, fixture.expectedAssembly);
            return [
              {
                fixtureId: fixture.id,
                status: diffs.length === 0 ? ('match' as const) : ('drift' as const),
                message: diffs.length === 0 ? 'Fixture matches the canonical assembly golden.' : summarizeDiffs(diffs.map((diff) => diff.path)),
              },
            ];
          })()
        : [
            {
              fixtureId: fixture.id,
              status: 'drift' as const,
              message: 'Supported solve result drifted from the expected unsupported fixture boundary.',
            },
          ];

  const hasInvariantFailure = invariants.some((invariant) => invariant.status === 'fail');
  const hasFixtureDrift = fixtureComparisons.some((comparison) => comparison.status === 'drift');

  return {
    status: hasInvariantFailure || hasFixtureDrift ? 'fail' : 'pass',
    invariants,
    unsupportedReasons: [],
    fixtureComparisons,
  };
}
