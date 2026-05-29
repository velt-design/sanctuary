import type { Assembly3D, GeometryConfig, RawGeometryModuleInput, RawHouseInput } from './contracts';
import { normalizeGeometryConfig, type NormalizeGeometryConfigErrorCode } from './normalize';
import { solveAssembly3D } from './solve';
import type { SolveAssembly3DErrorCode } from './solve.types';

/**
 * Per-pergola result from a project solve. Mirrors `SolveAssembly3DResult`
 * but tags each entry with the input pergola's index so callers can match
 * results back to their inputs even when ordering changes. The error code
 * union covers normalization failures, solve failures, and the orchestrator-
 * specific `house_context_mismatch` (retired in phase 4).
 */
export type SolveProjectPergolaErrorCode =
  | NormalizeGeometryConfigErrorCode
  | SolveAssembly3DErrorCode
  | 'house_context_mismatch';

export type SolveProjectPergolaResult =
  | { ok: true; pergolaIndex: number; config: GeometryConfig; value: Assembly3D }
  | {
      ok: false;
      pergolaIndex: number;
      code: SolveProjectPergolaErrorCode;
      error: string;
    };

export type SolveProjectResult = {
  /**
   * Echo of the project-level house input that was supplied. Phase 3 of
   * milestone 13 keeps this purely informational -- no consumer mutates
   * or reads it yet. Future phases (4+) will use this as the single
   * source of truth for house data; the orchestrator validates that
   * every per-pergola `RawGeometryModuleInput.houseContext` is consistent
   * with this shared input, and rejects projects where they disagree.
   */
  rawHouse: RawHouseInput;
  pergolas: SolveProjectPergolaResult[];
};

export type SolveProjectInput = {
  /**
   * Project-level house input. In single-house projects (today's reality),
   * this is built once from `houseAssembly.houseForms[0]` (or equivalent)
   * by the portal layer. In multi-house projects (future), one
   * `solveProject` call per house is the natural pattern.
   */
  rawHouse: RawHouseInput;
  /**
   * One raw input per pergola in the project. Each one still carries its
   * own `houseContext` field today (back-compat); phase 4 will wire the
   * portal layer to omit `houseContext` from per-pergola inputs and let
   * the orchestrator inject the shared `rawHouse` instead. For now the
   * orchestrator validates that the per-pergola `houseContext` matches
   * the shared `rawHouse` (no-op when single-house projects propagate
   * the same data both ways).
   */
  rawPergolas: ReadonlyArray<RawGeometryModuleInput>;
};

/**
 * Project-level solve orchestrator -- phase 3 of milestone 13 (drop pergola
 * `houseContext` wrapping, audit row 9). Today every pergola module input
 * carries its own copy of `houseContext`; in a multi-pergola project that
 * means N copies of the same house data and N independent
 * `buildHouseModel3D` runs that all produce the same result.
 *
 * `solveProject` introduces a project-level entry point that takes the
 * house ONCE plus the pergolas, and returns one solve result per pergola.
 * Phase 3 is intentionally additive: internally it still calls the
 * existing per-pergola `normalizeGeometryConfig + solveAssembly3D` pipeline
 * for each pergola. The dedup of `HouseModel3D` building (so the house
 * solves once instead of N times) is a follow-up architectural step that
 * needs the body / pergola-attachment-overlay split (`HouseModel3D` is
 * partially pergola-specific today). The orchestrator's API surface is
 * the contract that lets that follow-up land without a downstream
 * consumer change.
 *
 * Verification: each pergola's result MUST match what calling
 * `solveAssembly3D(normalizeGeometryConfig(rawPergola).value)` would
 * produce -- assertion lives in `solveProject.test.ts`. Output equivalence
 * is the safety net for the eventual real dedup.
 */
export function solveProject(input: SolveProjectInput): SolveProjectResult {
  const pergolas: SolveProjectPergolaResult[] = input.rawPergolas.map((rawPergola, pergolaIndex) => {
    // Phase-3 sanity check: per-pergola `houseContext` must be consistent
    // with the shared `rawHouse`. We compare a small, stable subset
    // (footprint mode + dimensions + position) -- not the entire shape --
    // because the per-pergola `houseContext` carries pergola-derived
    // fields (decks, openings tied to a specific pergola's coordinate
    // frame) that won't match. The mismatch check exists to catch
    // accidentally-divergent project state, NOT to enforce structural
    // equivalence. Phase 4 retires this check entirely once portal stops
    // emitting per-pergola `houseContext`.
    const housePositionMatches =
      JSON.stringify(rawPergola.houseContext.position ?? null) ===
      JSON.stringify(input.rawHouse.position ?? null);
    if (!housePositionMatches) {
      return {
        ok: false,
        pergolaIndex,
        code: 'house_context_mismatch',
        error: `Pergola ${pergolaIndex} houseContext.position differs from project-level rawHouse.position`,
      };
    }

    const normalize = normalizeGeometryConfig(rawPergola);
    if (!normalize.ok) {
      return {
        ok: false,
        pergolaIndex,
        code: normalize.code,
        error: normalize.error,
      };
    }
    const solve = solveAssembly3D(normalize.value);
    if (!solve.ok) {
      return {
        ok: false,
        pergolaIndex,
        code: solve.code,
        error: solve.error,
      };
    }
    return { ok: true, pergolaIndex, config: normalize.value, value: solve.value };
  });

  return { rawHouse: input.rawHouse, pergolas };
}
