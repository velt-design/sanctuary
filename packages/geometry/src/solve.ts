import type { GeometryConfig } from './contracts';
import { solveBoxAssembly3D } from './solveBox';
import { solveGableAssembly3D } from './solveGable';
import { solveHipCornerAssembly3D } from './solveHipCorner';
import { solveMonoAssembly3D } from './solveMono';
import type { SolveAssembly3DErrorCode, SolveAssembly3DResult } from './solve.types';

function fail(code: SolveAssembly3DErrorCode, error: string): SolveAssembly3DResult {
  return { ok: false, code, error };
}

export function solveAssembly3D(config: GeometryConfig): SolveAssembly3DResult {
  if (config.family === 'mono') {
    return solveMonoAssembly3D(config);
  }
  if (config.family === 'gable') {
    return solveGableAssembly3D(config);
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
    return {
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
    };
  }
  if (config.family === 'box') {
    return solveBoxAssembly3D(config);
  }
  if (config.family === 'hip_corner') {
    return solveHipCornerAssembly3D(config);
  }
  return fail('unsupported_family', `Family ${config.family} is not implemented yet.`);
}
