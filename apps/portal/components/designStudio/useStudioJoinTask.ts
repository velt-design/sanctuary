"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import type { WebsiteJoin } from "@/lib/designStudio/websiteJoinIntent";
import {
  previewWebsiteJoin,
  removeWebsiteJoin,
  websiteJoinStates,
} from "@/lib/designStudio/websiteJoins";
import { websiteComposition } from "@/lib/designStudio/websiteComposition";
import { websiteCompositionPriceEligibility } from "@/lib/designStudio/websiteCompositionEligibility";
import {
  studioJoinCanvasProjection,
  type StudioJoinIntent,
  type StudioJoinReadout,
} from "./studioJoinPresentation";

function admissibleJoin(edit: StudioAuthoringEdit, draft: WebsiteJoin) {
  const proposal = previewWebsiteJoin(edit, draft);
  const issue = websiteCompositionPriceEligibility(
    websiteComposition(proposal.edit),
    proposal.edit.site.websiteJoins,
  );
  if (issue) throw Error(issue);
  return proposal.edit;
}

/** One join intent and its canonical presentation. Session acceptance, Undo and
 * durable writes remain with Workspace's existing transaction owner. */
export function useStudioJoinTask({
  edit,
  identity,
  objectId,
  active,
  navigate,
  apply,
  change,
}: {
  edit: StudioAuthoringEdit;
  identity: StudioAuthoredIdentity;
  objectId: string;
  active: boolean;
  navigate: (request: { mode?: "position"; view?: "Plan" }) => void;
  apply: (
    create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
    accepted: () => void,
  ) => void;
  change: (next: StudioAuthoringEdit) => unknown;
}) {
  const [draft, setDraft] = useState<WebsiteJoin | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [identity.scopeKey, identity.epoch]);
  const preview = useMemo(() => {
    if (!draft?.b.objectId) return { edit: null, error: null };
    try {
      return { edit: admissibleJoin(edit, draft), error: null };
    } catch (e) {
      return { edit: null, error: (e as Error).message };
    }
  }, [edit, draft]);
  const states = useMemo(
    () =>
      active
        ? websiteJoinStates(edit).filter(
            (s) =>
              s.join.a.objectId === objectId || s.join.b.objectId === objectId,
          )
        : [],
    [edit, active, objectId],
  );
  const panel = useMemo<StudioJoinReadout>(() => {
    const object = edit.spatial.pergolas.find(
      (p) => p.id === (draft?.a.objectId ?? objectId),
    );
    return {
      objectId,
      states: states.map((s) => ({
        id: s.join.id,
        label: s.label,
        error: s.error,
        canReposition: !edit.spatial.pergolas.find(
          (p) => p.id === s.join.a.objectId,
        )?.attachment?.host,
      })),
      movingAttached: Boolean(object?.attachment?.host),
      canStart: !object?.attachment?.host && edit.spatial.pergolas.length >= 2,
      canCommit: !!draft?.b.objectId && !preview.error,
      error: preview.error,
      draft: draft
        ? {
            movingLabel: object?.label ?? "",
            edge: draft.a.edge,
            alignment: draft.alignment,
            hasTarget: !!draft.b.objectId,
            targetLabel: edit.spatial.pergolas.find(
              (p) => p.id === draft.b.objectId,
            )?.label,
            targetEdge: draft.b.edge,
          }
        : null,
    };
  }, [edit, objectId, draft, states, preview.error]);
  const canvas = useMemo(
    () => studioJoinCanvasProjection(edit, draft, preview.edit),
    [edit, draft, preview.edit],
  );
  function choose(value: WebsiteJoin | null) {
    setDraft(value);
    if (value) navigate({ view: "Plan" });
  }
  function complete(next: WebsiteJoin) {
    setDraft(next);
    if (!next.b.objectId) return;
    try {
      admissibleJoin(edit, next);
    } catch {
      return;
    }
    apply(
      (current) => admissibleJoin(current, next),
      () => {
        setDraft(null);
        navigate({ mode: "position" });
      },
    );
  }
  function dispatch(intent: StudioJoinIntent) {
    switch (intent.kind) {
      case "start":
        choose({
          id: crypto.randomUUID(),
          a: { objectId, edge: "right" },
          b: { objectId: "", edge: "left" },
          alignment: "centre",
        });
        break;
      case "reposition": {
        const state = states.find((s) => s.join.id === intent.id);
        if (state) choose(state.join);
        break;
      }
      case "cancel":
        choose(null);
        break;
      case "back":
        choose(null);
        navigate({ mode: "position" });
        break;
      case "edge":
        if (draft) complete({ ...draft, a: { ...draft.a, edge: intent.edge } });
        break;
      case "alignment":
        if (draft) complete({ ...draft, alignment: intent.alignment });
        break;
      case "target":
        if (draft)
          complete({ ...draft, b: { objectId: intent.id, edge: intent.edge } });
        break;
      case "remove":
        change(removeWebsiteJoin(edit, intent.id));
        break;
    }
  }
  const cancel = useCallback(() => setDraft(null), []);
  return {
    draft,
    preview,
    panel,
    canvas,
    dispatch,
    cancel,
  };
}
