import { useMemo } from "react";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import {
  createStudioSceneResolver,
  studioSceneInputKey,
} from "@/lib/designStudio/interaction/resolvedScene";

export function useStudioResolvedScene(
  edit: StudioAuthoringEdit | null,
  scopeKey: string,
) {
  const resolver = useMemo(() => createStudioSceneResolver(), [scopeKey]);
  // Session and proposal owners publish immutable snapshots. Pointer overlays keep
  // that snapshot, while authoring/restoration replaces it and rebuilds the key.
  const key = useMemo(() => (edit ? studioSceneInputKey(edit) : ""), [edit]);
  return useMemo(() => (edit ? resolver.resolve(edit) : null), [resolver, key]);
}
