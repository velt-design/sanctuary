import { applyAssemblyPosition3D } from './applyAssemblyPosition';
import type { GeometryConfig } from './contracts';
import { solveBoxAssembly3D } from './solveBox';
import { solveGableAssembly3D } from './solveGable';
import { solveHipCornerAssembly3D } from './solveHipCorner';
import { solveMonoAssembly3D } from './solveMono';
import type { SolveAssembly3DErrorCode, SolveAssembly3DResult } from './solve.types';

function fail(code: SolveAssembly3DErrorCode, error: string): SolveAssembly3DResult {
  return { ok: false, code, error };
}

/**
 * Apply the per-pergola world transform if `config.position` is set. Family
 * solvers emit pergola-local geometry — `applyAssemblyPosition3D` is the
 * single boundary that lifts that into world space so multi-pergola designs
 * place each pergola at its own origin/rotation. When `config.position` is
 * `null` (the legacy single-pergola-at-world-origin case), the call is a
 * no-op and the assembly passes through unchanged.
 */
function applyPositionIfSet(result: SolveAssembly3DResult, config: GeometryConfig): SolveAssembly3DResult {
  if (!result.ok || !config.position) return result;
  return { ok: true, value: applyAssemblyPosition3D(result.value, config.position) };
}

export function solveAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  if (config.family === 'mono') {
    return applyPositionIfSet(solveMonoAssembly3D(config), config);
  }
  if (config.family === 'gable') {
    return applyPositionIfSet(solveGableAssembly3D(config), config);
  }
  if (config.family === 'hip') {
    const sharedEaveUndersideMm =
      config.structural.heights.houseUndersideMm ??
      config.structural.heights.outerUndersideMm ??
      config.structural.heights.referenceUndersideMm ??
      null;
    const result = solveGableAssembly3D({
      ...config,
      family: 'gable',
      gable: {
        ...config.gable,
        endFramesMode: 'none',
        houseEaveGutterMode: config.connection.type === 'freestanding' ? 'our' : 'house',
        outerEaveGutterMode: 'our',
      },
      structural: {
        ...config.structural,
        heights: {
          ...config.structural.heights,
          houseUndersideMm: sharedEaveUndersideMm,
          outerUndersideMm: sharedEaveUndersideMm,
          referenceUndersideMm: sharedEaveUndersideMm,
        },
        profiles: {
          ...config.structural.profiles,
          ridge:
            config.structural.profiles.ridge ??
            config.structural.profiles.rafter ??
            config.structural.profiles.supportBeam,
        },
      },
    });
    if (!result.ok) {
      return result;
    }
    return applyPositionIfSet(
      {
        ok: true,
        value: {
          ...result.value,
          family: 'hip',
          semantics: {
            ...result.value.semantics,
            roofType: 'hip',
            primaryDimensionsMm: {
              length: config.dimensions.lengthMm,
              projection: config.dimensions.projectionMm,
            },
            secondaryDimensionsMm: null,
          },
        },
      },
      config,
    );
  }
  if (config.family === 'box') {
    return applyPositionIfSet(solveBoxAssembly3D(config), config);
  }
  if (config.family === 'hip_corner') {
    return applyPositionIfSet(solveHipCornerAssembly3D(config), config);
  }
  return fail('unsupported_family', `Family ${config.family} is not implemented yet.`);
}
