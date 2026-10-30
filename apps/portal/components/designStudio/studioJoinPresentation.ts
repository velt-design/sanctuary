import { solvePergolaPreview } from "@sp/configurator/geometry";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { WebsiteJoin } from "@/lib/designStudio/websiteJoinIntent";
import { websiteJoinTargets } from "@/lib/designStudio/websiteJoins";
import {
  websiteComposition,
  transformWebsitePoint,
} from "@/lib/designStudio/websiteComposition";

export type StudioJoinEdge = WebsiteJoin["a"]["edge"];
export type StudioJoinAlignment = WebsiteJoin["alignment"];
export type StudioJoinIntent =
  | { kind: "start" | "cancel" | "back" }
  | { kind: "reposition" | "remove"; id: string }
  | { kind: "edge"; edge: StudioJoinEdge }
  | { kind: "alignment"; alignment: StudioJoinAlignment }
  | { kind: "target"; id: string; edge: StudioJoinEdge };
export type StudioJoinReadout = {
  objectId: string;
  states: {
    id: string;
    label: string;
    error: string | null;
    canReposition: boolean;
  }[];
  movingAttached: boolean;
  canStart: boolean;
  canCommit: boolean;
  error: string | null;
  draft: {
    movingLabel: string;
    edge: StudioJoinEdge;
    alignment: StudioJoinAlignment;
    hasTarget: boolean;
    targetLabel: string | undefined;
    targetEdge: StudioJoinEdge;
  } | null;
};
export type StudioJoinCanvasProjection = {
  active: boolean;
  targets: {
    id: string;
    edge: StudioJoinEdge;
    label: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
  }[];
  proposed: {
    label: string;
    points: { x: number; y: number; z?: number }[];
  } | null;
};

/** Exact canonical adapter shared by the task and standalone Canvas callers.
 * The ghost is the solved Plan outline, distinct from physical contact faces. */
export function studioJoinCanvasProjection(
  edit: StudioAuthoringEdit,
  joinDraft: WebsiteJoin | null | undefined,
  preview: StudioAuthoringEdit | null | undefined,
): StudioJoinCanvasProjection {
  const targets = joinDraft
    ? websiteJoinTargets(edit, joinDraft.a.objectId)
    : [];
  const proposed = (() => {
    if (!joinDraft || !preview) return null;
    const r = websiteComposition(preview).find(
      (p) => p.object.id === joinDraft.a.objectId,
    );
    if (!r?.design || !r.position) return null;
    const g = solvePergolaPreview(
      r.design.input,
      r.design.roof,
      r.geometryOptions,
    ).geometry;
    return g
      ? {
          label: r.object.label,
          points: g.plan.outline.map((p) =>
            transformWebsitePoint(p, r.position!),
          ),
        }
      : null;
  })();
  return { active: !!joinDraft, targets, proposed };
}
