import type { Assembly3D } from './contracts';

export type SolveAssembly3DErrorCode = 'unsupported_family' | 'unsupported_variant' | 'insufficient_input';

export type SolveAssembly3DResult =
  | {
      ok: true;
      value: Assembly3D;
    }
  | {
      ok: false;
      code: SolveAssembly3DErrorCode;
      error: string;
    };
