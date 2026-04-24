import type { GeometryConfig } from './contracts';
import { solveBoxAssembly3D } from './solveBox';
import { solveGableAssembly3D } from './solveGable';
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
  if (config.family === 'box') {
    return solveBoxAssembly3D(config);
  }
  return fail('unsupported_family', `Family ${config.family} is not implemented yet.`);
}
