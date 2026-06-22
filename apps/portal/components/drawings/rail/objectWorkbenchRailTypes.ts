import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type CommitResult = { ok: boolean; error?: string };

export type FieldErrors = Record<string, string>;

export type RunRoofCommit = (fieldId: string, nextRoof: HouseFormRoofIntentModel) => Promise<void>;

export type RunAction = (
  fieldId: string,
  action: Promise<CommitResult> | CommitResult | undefined,
  fallbackMessage: string,
) => Promise<void>;
