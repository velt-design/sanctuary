"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {registerStudioPresentation} from '@/lib/designStudio/studioSessionLifecycle';
import type { StudioAuthoringEdit } from "@/lib/designStudio/authoringView";
import type { StudioAuthoredIdentity } from "@/lib/designStudio/interaction/contracts";
import type { ResolvedStudioScene } from "@/lib/designStudio/interaction/resolvedScene";
import type { StudioSaveScope } from "@/lib/designStudio/saveTransport";
import {
  parseStudioHouseScene,
  canonicalHouseProjection,
  type StudioHouse,
} from "@/lib/designStudio/studioHouseScene";
import { studioHouseFieldErrors } from "@/lib/designStudio/studioHouseGeometry";
import { updateStudioHouse } from "@/lib/designStudio/studioHouseCommands";
import { studioHouseDraftPreview } from "./studioHouseDraftPreview";
import { studioHouseHeightNotice } from "./studioHouseHeightNotice";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";

type Recovery = {
  schemaVersion: "studio_house_pending.v1";
  draft: StudioHouse;
  basis: StudioHouse["source"] | null;
  reviewRequired?: boolean;
  legacyPayload?: string;
};
type State = {
  lifetime: string;
  key: string;
  recovery: Recovery | null;
  original: string | null;
  previousKeys: string[];
};
const sourceKey = (source: StudioHouse["source"] | null | undefined) =>
  JSON.stringify(source ?? null);
function physicalSourceKey(source: StudioHouse["source"]) {
  const physical = { ...source };
  delete physical.appearance;
  return JSON.stringify(physical);
}
function physicalHouseKey(house: StudioHouse) {
  return JSON.stringify({ ...house, source: physicalSourceKey(house.source) });
}
const properties = [
  "widthMm",
  "depthMm",
  "wallHeightMm",
  "eaveHeightMm",
  "roof.form",
  "roof.pitchDeg",
  "roof.fall",
  "roof.ridge",
  "roof.overhangMm",
  "roof.fasciaHeightMm",
  "source.soffitDepthMm",
  "source.gutterWidthMm",
  "source.gutterDepthMm",
  "source.gutterProjectionMm",
  "source.appearance.wallMaterial",
  "source.appearance.roofProfile",
  "source.appearance.roofTrayWidth",
  "source.appearance.roofColour",
  "position.xMm",
  "position.yMm",
  "position.rotationDeg",
] as const;
export type StudioHouseProperty = (typeof properties)[number];
function property(
  house: StudioHouse,
  name: StudioHouseProperty,
): string | undefined {
  const [group, key, appearanceField] = name.split(".");
  if (appearanceField) {
    const value =
      house.source.appearance?.[
        appearanceField as keyof NonNullable<
          StudioHouse["source"]["appearance"]
        >
      ];
    return value === undefined ? undefined : String(value);
  }
  return key
    ? (
        house[group as "roof" | "source" | "position"] as unknown as Record<
          string,
          string | undefined
        >
      )[key]
    : house[name as "widthMm" | "depthMm" | "wallHeightMm" | "eaveHeightMm"];
}
function withProperty(
  house: StudioHouse,
  name: StudioHouseProperty,
  value: string | undefined,
): StudioHouse {
  const [group, key, appearanceField] = name.split(".");
  if (appearanceField)
    return {
      ...house,
      source: {
        ...house.source,
        appearance: {
          ...house.source.appearance,
          [appearanceField]:
            appearanceField === "roofTrayWidth" ? Number(value) : value,
        },
      },
    };
  if (!key) return { ...house, [name]: value };
  if (group === "roof")
    return { ...house, roof: { ...house.roof, [key]: value } };
  if (group === "position")
    return { ...house, position: { ...house.position, [key]: value } };
  return { ...house, source: { ...house.source, [key]: value } };
}
function read(key: string): Pick<State, "recovery" | "original"> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
    if (!raw) return { recovery: null, original: null };
    const value = JSON.parse(raw);
    const wrapped = value.schemaVersion === "studio_house_pending.v1";
    const draft = parseStudioHouseScene({
      schemaVersion: "studio_house_scene.v1",
      houses: [wrapped ? value.draft : value],
      attachments: [],
    }).houses[0];
    // The basis is authoring data only, never a projected/solved provider value.
    const basis =
      wrapped && value.basis && value.basis.id === draft.id
        ? (value.basis as StudioHouse["source"])
        : null;
    return {
      recovery: {
        schemaVersion: "studio_house_pending.v1",
        draft,
        basis,
        ...(value.reviewRequired ? { reviewRequired: true } : {}),
        ...(!wrapped
          ? { legacyPayload: raw }
          : value.legacyPayload
            ? { legacyPayload: value.legacyPayload }
            : {}),
      },
      original: raw,
    };
  } catch {
    return { recovery: null, original: raw };
  }
}

/** A single raw house draft outlives the conditional Inspector. Recovery is local
 * intent; only the existing session can accept an authored house command. */
export function useStudioHouseDraft({
  edit,
  resolved,
  selected,
  scope,
  identity,
  apply,
}: {
  edit: StudioAuthoringEdit;
  resolved: ResolvedStudioScene;
  selected: string;
  scope: StudioSaveScope;
  identity: StudioAuthoredIdentity;
  apply: (
    create: (current: StudioAuthoringEdit) => StudioAuthoringEdit,
    accepted: (edit: StudioAuthoringEdit) => void,
  ) => void;
}) {
  const key = `${scope.actorId}:${scope.projectId}:${scope.estimateId}:${edit.designId}:${edit.revision}:studio-house-pending`;
  const lifetime = `${JSON.stringify(scope)}:${identity.epoch}`;
  const currentLifetime = useRef(lifetime);
  currentLifetime.current = lifetime;
  const [state, setState] = useState<State>(() => ({
    lifetime,
    key,
    recovery: null,
    original: null,
    previousKeys: [],
  }));
  const [ready, setReady] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  useEffect(() => {
    setState((previous) => {
      if (previous.lifetime !== lifetime) {
        // A live replacement is not a reload. Do not import the prior epoch's
        // active draft just because its address happens to be identical.
        return {
          lifetime,
          key,
          ...(previous.key === key
            ? {
                recovery: null,
                original:
                  previous.original ??
                  (previous.recovery
                    ? JSON.stringify(previous.recovery)
                    : null),
              }
            : read(key)),
          previousKeys: [],
        };
      }
      if (ready === null)
        return { lifetime, key, ...read(key), previousKeys: [] };
      if (previous.key !== key)
        return {
          ...previous,
          key,
          original: null,
          previousKeys: [...previous.previousKeys, previous.key],
        };
      return previous;
    });
    setReady(lifetime);
    setLocalError(null);
  }, [lifetime, key]);
  const flushDraft=()=>{
    if (
      ready !== lifetime ||
      state.lifetime !== lifetime ||
      state.key !== key ||
      currentLifetime.current !== lifetime
    )
      return true;
    try {
      if (state.recovery)
        sessionStorage.setItem(
          key,
          state.original ?? JSON.stringify(state.recovery),
        );
      else if (state.original === null) sessionStorage.removeItem(key);
      // Acknowledgement rollover is a write-before-remove, never a rehydrate.
      for (const old of state.previousKeys)
        if (old !== key) sessionStorage.removeItem(old);
      return true;
    } catch {
      return false; // Raw memory and the old recovery remain available.
    }
  };
  const flushRef=useRef(flushDraft);flushRef.current=flushDraft;
  useLayoutEffect(()=>{
    if(!flushDraft())setLocalError('The house choices could not be stored on this device. Keep this editor open and try again.');
  },[state,key,ready,lifetime]);
  useEffect(()=>registerStudioPresentation(scope.actorId,()=>flushRef.current()),[scope.actorId]);
  const recovery = state.lifetime === lifetime ? state.recovery : null;
  const draft = recovery?.draft ?? null;
  const target = draft
    ? edit.spatial.houseAssembly?.houseForms.find((h) => h.id === draft.id)
    : null;
  const targetKey = sourceKey(target);
  const targetEditable =
    !!draft && !!resolved.houseRecords.find((h) => h.id === draft.id)?.house;
  const changed = !!draft && sourceKey(recovery?.basis) !== targetKey;
  useEffect(() => {
    if (changed && recovery?.basis && !recovery.reviewRequired)
      setState((previous) =>
        previous.lifetime !== lifetime || !previous.recovery
          ? previous
          : {
              ...previous,
              original: null,
              recovery: { ...previous.recovery, reviewRequired: true },
            },
      );
  }, [changed, recovery?.reviewRequired, lifetime]);
  const stale = !!draft && (!target || changed || recovery?.reviewRequired);
  const notice =
    draft && !target
      ? "The original house is no longer available. Your raw house changes are retained and will not be applied to another house."
      : draft && !recovery?.basis
        ? "The original basis of this recovered input is unverified. Review each field against the current house, then press Enter or leave that field to complete it."
        : !targetEditable && draft
          ? "The current house cannot be edited as a simple rectangle. Your raw house changes are retained."
          : stale
            ? "The house changed after this input began. Your raw fields are retained. Review each field against the current house before completing it."
            : null;
  const houseRecord = resolved.houseRecords.find(
    (record) => record.id === selected,
  );
  const house = houseRecord?.house ?? null;
  const currentHouse = house ? (draft?.id === house.id ? draft : house) : null;
  const appearanceError =
    currentHouse?.source.appearance?.roofColour !== undefined &&
    !/^#[0-9a-fA-F]{6}$/.test(currentHouse.source.appearance.roofColour)
      ? "Enter a six-digit HEX roof colour, for example #343b39."
      : null;
  const fieldErrors = useMemo(
    () => (currentHouse ? studioHouseFieldErrors(currentHouse) : {}),
    [currentHouse],
  );
  const validation = useMemo(() => {
    if (!draft) return { edit: null, error: null };
    const error = Object.values(studioHouseFieldErrors(draft))[0];
    if (error) return { edit: null, error };
    const current = resolved.houseRecords.find(
      (record) => record.id === draft.id,
    )?.house;
    // Appearance is completed separately. Raw colour never becomes a geometry
    // preview or repeats the existing shape/attachment command.
    if (current && physicalHouseKey(current) === physicalHouseKey(draft))
      return { edit: null, error: null };
    return studioHouseDraftPreview(edit, draft);
  }, [resolved, draft]);
  const preview = stale ? { edit: null, error: validation.error } : validation;
  const error =
    localError ??
    appearanceError ??
    validation.error ??
    (!draft ? houseRecord?.error : null) ??
    null;
  const inspectorError =
    draft && draft.id !== house?.id
      ? (localError ?? houseRecord?.error ?? null)
      : error;
  const heightNotice = useMemo(() => {
    if (!currentHouse || Object.keys(fieldErrors).length) return null;
    const current = resolved.houseRecords.find(
      (record) => record.id === currentHouse.id,
    );
    const roof =
      current?.house &&
      physicalHouseKey(current.house) === physicalHouseKey(currentHouse)
        ? current.geometry?.roof.flat()
        : undefined;
    return studioHouseHeightNotice(currentHouse, roof);
  }, [currentHouse, fieldErrors, resolved]);
  function replace(next: StudioHouse) {
    if (currentLifetime.current !== lifetime) return;
    if (draft && draft.id !== next.id) {
      setLocalError(
        "The other house has retained input. Return to it or discard that input before editing another house.",
      );
      return;
    }
    const basis = edit.spatial.houseAssembly?.houseForms.find(
      (h) => h.id === next.id,
    );
    setLocalError(null);
    setState((previous) => ({
      ...previous,
      lifetime,
      key,
      original: null,
      recovery: {
        schemaVersion: "studio_house_pending.v1",
        draft: next,
        basis:
          recovery?.basis ?? (draft ? null : structuredClone(basis ?? null)),
        ...(recovery?.reviewRequired ? { reviewRequired: true } : {}),
        ...(recovery?.legacyPayload
          ? { legacyPayload: recovery.legacyPayload }
          : {}),
      },
    }));
  }
  function discard() {
    if (currentLifetime.current !== lifetime) return;
    setState((previous) => ({ ...previous, recovery: null, original: null }));
    setLocalError(null);
  }
  function complete(
    name: StudioHouseProperty,
    raw: string | undefined = currentHouse
      ? property(currentHouse, name)
      : undefined,
  ) {
    if (!house || currentLifetime.current !== lifetime) return;
    if (draft && draft.id !== house.id) {
      setLocalError(
        "Return to the house with retained input or discard that input before editing another house.",
      );
      return;
    }
    const next = withProperty(draft ?? house, name, raw);
    replace(next);
    // A refused roof form can require a pitch repair. Finishing that pitch
    // completes the displayed roof choice, never unrelated raw dimensions.
    const roofChoice =
      name === "roof.pitchDeg" && next.roof.form !== house.roof.form
        ? next.roof.form
        : null;
    const completed: StudioHouseProperty[] = roofChoice
      ? [name, "roof.form"]
      : [name];
    const completedHouse = (live: StudioHouse) => {
      const changed = withProperty(live, name, raw);
      return roofChoice
        ? { ...changed, roof: { ...changed.roof, form: roofChoice } }
        : changed;
    };
    const reviewed = sourceKey(house.source);
    const appearance = name.startsWith("source.appearance.");
    const projectSource = (source: StudioHouse["source"]) => {
      const current = resolved.houseRecords.find(
        (record) => record.id === source.id,
      )?.house;
      return current &&
        physicalSourceKey(current.source) === physicalSourceKey(source)
        ? { ...current, source }
        : canonicalHouseProjection(source, edit.spatial);
    };
    const update = (current: StudioAuthoringEdit, proposal: StudioHouse) => {
      if (!appearance) return updateStudioHouse(current, proposal);
      const result = applyStudioHouseEdit(current.spatial, {
        kind: "appearance",
        houseFormId: proposal.id,
        patch: proposal.source.appearance!,
      });
      if (!result.ok) throw Error(result.message);
      return { ...current, spatial: result.spatial };
    };
    const retainOtherFields = (accepted: StudioAuthoringEdit) => {
      const basis = accepted.spatial.houseAssembly!.houseForms.find(
        (h) => h.id === house.id,
      )!;
      const live = projectSource(basis);
      const old = recovery?.basis ? projectSource(recovery.basis) : house;
      let retained = live;
      for (const field of properties)
        if (
          !completed.includes(field) &&
          property(next, field) !== property(old, field)
        )
          retained = withProperty(retained, field, property(next, field));
      if (
        properties.every(
          (field) => property(retained, field) === property(live, field),
        )
      ) {
        discard();
        return;
      }
      setState((previous) => ({
        ...previous,
        original: null,
        recovery: {
          schemaVersion: "studio_house_pending.v1",
          ...(recovery?.legacyPayload
            ? { legacyPayload: recovery.legacyPayload }
            : {}),
          draft: retained,
          basis: structuredClone(basis),
        },
      }));
      setLocalError(null);
    };
    try {
      // Validate just this completed property against the displayed accepted
      // house. Unfinished fields never enter a command or change the model.
      const proposal = completedHouse(house);
      update(edit, proposal);
      if (
        completed.every((field) => {
          const value = property(proposal, field),
            previous = property(house, field);
          return (
            value === previous ||
            (value?.trim() &&
              previous?.trim() &&
              Number(value) === Number(previous))
          );
        })
      ) {
        retainOtherFields(edit);
        return;
      }
      apply((current) => {
        const form = current.spatial.houseAssembly?.houseForms.find(
          (h) => h.id === house.id,
        );
        if (!form || sourceKey(form) !== reviewed)
          throw Error(
            "The house changed again. Review the current house before completing this field.",
          );
        return update(current, completedHouse(projectSource(form)));
      }, retainOtherFields);
    } catch (error) {
      setLocalError((error as Error).message);
    }
  }
  return {
    recoveryReady: ready === lifetime && state.lifetime === lifetime && state.key === key,
    hasRetainedInput: !!draft || state.original !== null,
    draft,
    currentHouse,
    fieldErrors,
    preview,
    error,
    inspectorError,
    heightNotice,
    appearanceError,
    notice,
    pending: !!draft,
    missingTarget: !!draft && (!target || !targetEditable),
    replace,
    complete,
    completeRotation: (raw = currentHouse?.position.rotationDeg) =>
      complete("position.rotationDeg", raw),
    discard,
  };
}
