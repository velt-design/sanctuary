"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import type { ResolvedStudioScene } from "@/lib/designStudio/interaction/resolvedScene";
import {
  previewStudioAttachmentAtAnchor,
  type StudioAttachmentChoice,
} from "@/lib/designStudio/studioAttachmentPreview";
import { StudioConnectionError } from "@/lib/designStudio/studioConnectionDiagnostics";
import { studioHouseTargets } from "@/lib/designStudio/studioHouseGeometry";
import type { HouseReference } from "@/lib/designStudio/studioHouseScene";
import {
  changeStudioProduct,
  detachStudioPergola,
  retainedStudioCanonicalBinding,
} from "@/lib/designStudio/studioHouseCommands";
import { detachWebsitePergola } from "@/lib/designStudio/websiteAttachment";
import {
  parseStudioWebsiteDesign,
  type StudioWebsiteDesign,
} from "@/lib/designStudio/websiteDesign";
import { prospectiveStudioFacadeClearance } from "@/lib/designStudio/studioFacadeClearance";
import { attachmentUnavailable } from "@sp/configurator/geometry";
import { CUSTOMER_DIMENSION_BOUNDS } from "@sp/configurator/core";
import { studioConnectionSwitchTarget, previewStudioConnectionSwitch } from '@/lib/designStudio/studioConnectionSwitch';

type Method = StudioAttachmentChoice["method"];
type Location = {
  selected: string;
  section: "Shape" | "Roof" | "Sides" | "Lighting";
  mode: "options" | "position" | "attachment" | "join";
  view?: "Plan" | "3D" | "Split";
};
type Repair = Location & {
  choice: StudioAttachmentChoice | null;
  anchor: HouseReference["position"] | null;
  method: Method;
  automatic?: boolean;
  note?: string;
};
type Intent =
  | {
      kind:
        | "begin"
        | "cancel"
        | "applied"
        | "selection"
        | "return"
        | "highlight"
        | "freestanding";
    }
  | { kind: "method"; method: Method }
  | { kind: "target"; target: ReturnType<typeof studioHouseTargets>[number] }
  | { kind: "clearance"; raw: string }
  | { kind: "repair"; target: "house" | "pergola"; focus?: "height" }
  | { kind: "retain-repair"; selected: string };
function currentValue(
  edit: StudioAuthoringEdit,
  id: string,
): StudioWebsiteDesign {
  const row = edit.objectOptions.find((row) => row.objectId === id),
    value = parseStudioWebsiteDesign(row?.values.websiteDesign, id);
  if (!value.ok) throw Error(value.message);
  return value.value;
}

/** Inline connection intent and measured repair. A refused choice is visible
 * here, not a second authoring mode or a global preview/save/drag lock. */
export function useStudioConnectionTask({
  edit,
  resolved,
  identity,
  location,
  housePending,
  navigate,
  apply,
}: {
  edit: StudioAuthoringEdit;
  resolved: ResolvedStudioScene;
  identity: StudioAuthoredIdentity;
  location: Location;
  housePending: boolean;
  navigate: (request: Partial<Location> & { focus?: string }) => void;
  apply: (
    create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
    accepted: () => void,
  ) => void;
}) {
  const [choice, setChoice] = useState<StudioAttachmentChoice | null>(null),
    [requestedMethod, setRequestedMethod] = useState<Method | null>(null);
  const [anchor, setAnchor] = useState<HouseReference["position"] | null>(null),
    [repairContext, setRepairContext] = useState<Repair | null>(null);
  const [repairEdge, setRepairEdge] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);
  const [automatic, setAutomatic] = useState<boolean | undefined>();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const id = repairContext?.selected ?? location.selected;
  const product =
    resolved.rows.find((row) => row.object.id === id) ?? resolved.rows[0];
  const binding = useMemo(
    () =>
      resolved.scene.attachments.find(
        (binding) => binding.objectId === product?.object.id,
      ) ??
      (product
        ? (retainedStudioCanonicalBinding(edit, product.object.id, product) ??
          undefined)
        : undefined),
    [edit, resolved.scene.attachments, product],
  );
  const method =
    requestedMethod ?? product?.value?.selection.input.connection ?? "facade";
  const clearChoice = useCallback(() => {
    setChoice(null);
    setRequestedMethod(null);
    setAnchor(null);
    setAutomatic(undefined);
    setSelectionError(null);
  }, []);
  const resetSelection = useCallback(() => {
    clearChoice();
    setRepairContext(null);
    setRepairEdge(null);
  }, [clearChoice]);
  const lifetime = identity.scopeKey + ":" + identity.epoch,
    previousLifetime = useRef(lifetime);
  useEffect(() => {
    if (previousLifetime.current !== lifetime) {
      previousLifetime.current = lifetime;
      resetSelection();
    }
  }, [lifetime, resetSelection]);
  const preview = useMemo(() => {
    if (!choice)
      return {
        edit: null,
        error: selectionError,
        measurements: null as StudioConnectionError["measurements"],
      };
    try {
      return {
        ...(automatic === undefined ? previewStudioAttachmentAtAnchor(edit, choice, anchor) : previewStudioConnectionSwitch(edit, studioConnectionSwitchTarget(edit, choice.objectId, choice.method))),
        error: null,
        measurements: null,
      };
    } catch (error) {
      return {
        edit: null,
        error:
          error instanceof Error ? error.message : "Connection unavailable.",
        measurements:
          error instanceof StudioConnectionError ? error.measurements : null,
      };
    }
  }, [edit, choice, anchor, automatic, selectionError]);
  const targets = useMemo(() => {
    const value = product?.value;
    if (!value) return [];
    const design = product.design ?? value.selection;
    if (attachmentUnavailable(design.input, design.roof, method)) return [];
    return resolved.houses.flatMap((geometry) => {
      try {
        return studioHouseTargets(geometry.house, method, geometry).filter(
          (target) => target.kind === (method === "facade" ? "wall" : "eave"),
        );
      } catch {
        return [];
      }
    });
  }, [resolved, product, method]);
  const repairMeasurements =
    preview.measurements ??
    (product?.attachment && "measurements" in product.attachment
      ? product.attachment.measurements
      : null);
  const repairBinding = choice ?? binding;
  const edgeLabel = repairBinding
    ? `${resolved.scene.houses.find((h) => h.id === repairBinding.houseId)?.label ?? "House"} · ${repairBinding.edge} ${repairBinding.kind === "wall" ? "wall" : "roof edge"}`
    : "House connection";
  const currentEdgeLabel = binding
    ? `${resolved.scene.houses.find((h) => h.id === binding.houseId)?.label ?? "House"} · ${binding.edge} ${binding.kind === "wall" ? "wall" : "roof edge"}`
    : null;
  function complete(
    next: StudioAttachmentChoice,
    position: HouseReference["position"] | null,
    projectToEdge?: boolean,
  ) {
    setChoice(next);
    setRequestedMethod(next.method);
    setAnchor(position);
    setAutomatic(projectToEdge);
    setSelectionError(null);
    const resolve = (current: StudioAuthoringEdit) => projectToEdge === undefined
      ? previewStudioAttachmentAtAnchor(current, next, position)
      : previewStudioConnectionSwitch(current, studioConnectionSwitchTarget(current, next.objectId, next.method));
    try {
      if (resolve(edit).edit === edit) {
        clearChoice();
        return;
      }
    } catch {
      return;
    }
    apply(
      (current) =>
        resolve(current).edit,
      () => {
        clearChoice();
        navigate({
          selected: next.objectId,
          mode: "options",
          section: "Shape",
        });
      },
    );
  }
  function dispatch(intent: Intent) {
    switch (intent.kind) {
      case "begin":
        clearChoice();
        navigate({
          mode: "options",
          section: "Shape",
          focus: "House connection",
        });
        return;
      case "method": {
        if (!product?.value) return;
        let applied = false;
        apply(current => {
          setRequestedMethod(intent.method);
          setChoice(null);
          setAnchor(null);
          setAutomatic(undefined);
          setSelectionError(null);
          try {
            const target = studioConnectionSwitchTarget(current, product.object.id, intent.method);
            setChoice(target.choice);
            setAnchor(target.anchor);
            setAutomatic(target.projectToEdge);
            const result = previewStudioConnectionSwitch(current, target);
            applied = true;
            return result.edit;
          } catch (error) {
            setSelectionError(error instanceof Error ? error.message : 'Connection unavailable.');
            return current;
          }
        }, () => {
          if (!applied) return;
          clearChoice();
          navigate({ selected: product.object.id, mode: 'options', section: 'Shape' });
        });
        return;
      }
      case "target": {
        if (!product?.value) return;
        const target = intent.target,
          clearance = prospectiveStudioFacadeClearance(product.value, method);
        const same =
          binding?.houseId === target.houseId && binding.edge === target.side;
        complete(
          {
            objectId: product.object.id,
            houseId: target.houseId,
            edge: target.side,
            kind: target.kind,
            method,
            ...(clearance !== undefined
              ? { facadeClearanceMm: clearance }
              : {}),
          },
          same ? (product.position ?? binding.reference.position) : null,
        );
        return;
      }
      case "clearance": {
        if (!product?.value) return;
        // Editing a measured clearance never changes the house model.
        setAutomatic(undefined);
        const pending =
          choice?.method === "facade"
            ? { ...choice, facadeClearanceMm: intent.raw }
            : null;
        if (pending) setChoice(pending);
        let connected = false;
        apply(
          (current) => {
            const value = currentValue(current, product.object.id),
              withValue = changeStudioProduct(current, {
                ...value,
                facadeClearanceMm: intent.raw,
              });
            if (!pending) return withValue;
            try {
              const result = previewStudioAttachmentAtAnchor(
                withValue,
                pending,
                anchor,
              ).edit;
              connected = true;
              return result;
            } catch {
              return withValue;
            }
          },
          () => {
            if (!pending || connected) clearChoice();
          },
        );
        return;
      }
      case "freestanding": {
        if (!product?.value) return;
        apply((current) => {
          if (product.studioAttachment)
            return detachStudioPergola(
              current,
              product.object.id,
              !!product.error,
            );
          if (product.object.attachment?.host)
            return detachWebsitePergola(current, product.object.id);
          const value = currentValue(current, product.object.id);
          return changeStudioProduct(current, {
            ...value,
            selection: {
              ...value.selection,
              roof: {
                ...value.selection.roof,
                attachmentIntent: "freestanding",
              },
            },
          });
        }, clearChoice);
        return;
      }
      case "repair": {
        const attached = choice ?? binding;
        if (!product || !attached) return;
        const measure = repairMeasurements,
          height =
            intent.focus === "height" ||
            (measure?.supportDatumMm !== undefined &&
              (measure.supportDatumMm <
                CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum ||
                measure.supportDatumMm >
                  CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum));
        setRepairContext({
          ...location,
          selected: product.object.id,
          mode: "options",
          section: "Shape",
          choice,
          anchor,
          method,
          automatic,
          ...(height
            ? {
                note: "Enter the measured house height, then return to the pergola. The house remains fixed when you change roof clearance.",
              }
            : {}),
        });
        setChoice(null);
        setRequestedMethod(null);
        setRepairEdge(measure?.target ?? null);
        navigate(
          intent.target === "house"
            ? {
                selected: attached.houseId,
                mode: "options",
                focus: height
                  ? "Eave height (mm)"
                  : attached.edge === "left" || attached.edge === "right"
                    ? "Depth (mm)"
                    : "Width (mm)",
              }
            : {
                selected: product.object.id,
                mode: "options",
                section: "Shape",
                focus: "Width in millimetres",
              },
        );
        return;
      }
      case "return": {
        if (!repairContext || housePending) return;
        const retained = repairContext;
        setRepairContext(null);
        setRepairEdge(null);
        navigate({
          selected: retained.selected,
          section: "Shape",
          mode: "options",
          focus: "House connection",
        });
        if (retained.choice) complete(retained.choice, retained.anchor, retained.automatic);
        else clearChoice();
        return;
      }
      case "retain-repair":
        setRepairContext({
          ...location,
          selected: intent.selected,
          choice,
          anchor,
          method,
          automatic,
        });
        return;
      case "highlight":
        navigate({ view: "Plan" });
        return;
      case "selection":
        resetSelection();
        return;
      case "cancel":
        clearChoice();
        return;
      case "applied":
        clearChoice();
        return;
    }
  }
  return {
    choice,
    method,
    binding,
    targets,
    preview,
    repairContext,
    repairEdge,
    repairMeasurements,
    edgeLabel,
    currentEdgeLabel,
    resetSelection,
    dispatch,
  };
}
