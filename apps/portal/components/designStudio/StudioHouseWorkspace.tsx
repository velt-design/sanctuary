"use client";
import {StudioDocumentContext} from './StudioDocumentContext';
import StudioObjectMenu from "./StudioObjectMenu";
import { useStudioKeyboard, type StudioShortcut } from "./useStudioKeyboard";
import {
  copyStudioSceneObject,
  pasteStudioSceneObject,
  removeStudioSceneObject,
  nudgeStudioSceneObject,
} from "@/lib/designStudio/studioSceneCommands";
import { useStudioJoinTask } from "./useStudioJoinTask";
import { useStudioConnectionTask } from "./useStudioConnectionTask";
import { useStudioHouseDraft } from "./useStudioHouseDraft";
import StudioHouseConnectionControls from "./StudioHouseConnectionControls";
import StudioHouseInspector from "./StudioHouseInspector";
import StudioDesignHeading from "./StudioDesignHeading";
import StudioWorkspaceSubtotal from "./StudioWorkspaceSubtotal";
import type { StudioDesignIdentity } from "@/lib/designStudio/studioDesignIdentity";
import { useContext, useCallback, useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import dynamic from "next/dynamic";
import { loadStudioHouseCanvasModule } from "./studioLeafLoading";
import {
  LightingProvider,
  PreviewBlindProvider,
} from "@sp/configurator/react/controls";
import type { StudioSaveScope } from "@/lib/designStudio/saveTransport";
import type { StudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import {
  changeStudioProduct,
  detachStudioPergola,
  independentStudioDatum,
} from "@/lib/designStudio/studioHouseCommands";
import {
  positionWebsitePergola,
  addWebsitePergola,
} from "@/lib/designStudio/websiteComposition";
import { useStudioEditingSession } from "./useStudioEditingSession";
import { useStudioWebsitePrice } from "./useStudioWebsitePrice";
import type {StudioOpeningPrice} from '@/lib/designStudio/studioOpening';
import StudioWebsiteControls from "./StudioWebsiteControls";
import StudioCoordinateInput from "./StudioCoordinateInput";
import { studioDisplayProduct } from "@/lib/designStudio/studioDisplayProduct";
import StudioHouseProductNavigation from "./StudioHouseProductNavigation";
import StudioWebsiteJoinControls from "./StudioWebsiteJoinControls";
import { applyStudioPergolaEdit } from "@/lib/designStudio/pergolaEditing";
import css from "./StudioWebsite.module.css";
import { applyStudioHouseEdit } from "@/lib/designStudio/houseEditing";
import StudioWebsiteRecovery from "./StudioWebsiteRecovery";
import { useStudioDirectPlacement } from "./useStudioDirectPlacement";
import { useStudioResolvedScene } from "./useStudioResolvedScene";
import { studioProductIssue } from "@/lib/designStudio/studioProductIssue";
import StudioConnectionRepair from "./StudioConnectionRepair";
import {
  studioHouseContextKey,
  readStudioHouseContext,
  studioContextLabel,
  studioHouseSelection,
  type StudioSceneView,
} from "./studioHouseContext";
const Scene = dynamic(loadStudioHouseCanvasModule, { ssr: false });
type Controller = ReturnType<typeof useStudioEditingSession>;
export default function StudioHouseWorkspace({
  controller,
  scope,
  versionLabel,
  identity,
  openingPrice,
}: {
  controller: Controller;
  scope: StudioSaveScope;
  versionLabel: string;
  identity?: StudioDesignIdentity;
  openingPrice?:StudioOpeningPrice;
}) {
  const prefetch=useContext(StudioDocumentContext)?false:undefined;
  const propertyUndo = useRef<{
    field: HTMLInputElement;
    lifetime: string;
    objectId: string;
    group: string;
  } | null>(null);
  const propertyChange = useRef<EventTarget | null>(null);
  const editingObject = useRef("");
  const editLifetime = `${controller.authoredIdentity.scopeKey}:${controller.authoredIdentity.epoch}`;
  const originalController = controller;
  const sessionChange = controller.change;
  const changeEdit = useCallback<Controller["change"]>(
    (next, history) => {
      const field = propertyUndo.current;
      const grouped =
        field &&
        field.lifetime === editLifetime &&
        field.objectId === editingObject.current &&
        field.field === document.activeElement &&
        field.field === propertyChange.current;
      const outcome = sessionChange(next, {
        ...history,
        selectionBefore: editingObject.current,
        group: grouped ? field.group : history?.group,
      });
      if (outcome.kind !== "accepted") setError(outcome.reason);
      return outcome;
    },
    [sessionChange, editLifetime],
  );
  const transactEdit = useCallback<Controller["transact"]>(
    (expected, create, history) =>
      originalController.transact(expected, create, {
        selectionBefore: editingObject.current,
        ...history,
      }),
    [originalController.transact],
  );
  controller = { ...controller, change: changeEdit, transact: transactEdit };
  const edit = controller.edit!,
    resolved = useStudioResolvedScene(
      edit,
      `${JSON.stringify(scope)}:${controller.authoredIdentity?.epoch ?? ""}`,
    )!,
    scene = resolved.scene,
    products = resolved.rows;
  const [selection, setSelected] = useState(
      resolved.houseRecords[0]?.id ?? products[0]?.object.id ?? "",
    ),
    [section, choose] = useState<"Shape" | "Roof" | "Sides" | "Lighting">(
      "Shape",
    ),
    [mode, setMode] = useState<"options" | "attachment" | "position" | "join">(
      "options",
    ),
    [error, setError] = useState<string | null>(null);
  const selected = studioHouseSelection(selection, [
    ...resolved.houseRecords.map((record) => record.id),
    ...products.map((p) => p.object.id),
  ]);
  editingObject.current = selected;
  const [view, setView] = useState<StudioSceneView>("3D"),
    [contextReady, setContextReady] = useState<string | null>(null);
  const contextKey = studioHouseContextKey(scope);
  useEffect(() => {
    try {
      const c = readStudioHouseContext(sessionStorage.getItem(contextKey), [
        ...resolved.houseRecords.map((record) => record.id),
        ...products.map((p) => p.object.id),
      ]);
      if (c) {
        setSelected(c.selected);
        setMode(c.mode);
        choose(c.section);
        setView(c.view);
      } else {
        setSelected(
          resolved.houseRecords[0]?.id ?? products[0]?.object.id ?? "",
        );
        setMode("options");
        choose("Shape");
        setView("3D");
      }
    } catch {}
    setContextReady(contextKey);
  }, [contextKey]);
  useLayoutEffect(() => {
    if (contextReady !== contextKey) return;
    try {
      sessionStorage.setItem(
        contextKey,
        JSON.stringify({
          selected,
          mode: mode === "attachment" || mode === "join" ? "position" : mode,
          section,
          view,
        }),
      );
    } catch {}
  }, [contextReady, contextKey, selected, mode, section, view]);
  const product = products.find((p) => p.object.id === selected) ?? products[0],
    houseRecord = resolved.houseRecords.find(
      (record) => record.id === selected,
    ),
    house = houseRecord?.house ?? undefined,
    binding = scene.attachments.find((a) => a.objectId === product?.object.id);
  useEffect(() => {
    propertyUndo.current = null;
    setError(null);
  }, [controller.authoredIdentity.scopeKey, controller.authoredIdentity.epoch]);
  const joins = resolved.joins,
    invalidJoin = joins.find((s) => s.error);
  const arrangementError = useMemo(
    () =>
      products.length && products.every((p) => !p.error)
        ? resolved.arrangementEligibility
        : null,
    [resolved],
  );
  const controlsRef = useRef<HTMLFieldSetElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (
      controller.canEdit &&
      contextReady === contextKey &&
      (!document.activeElement || document.activeElement === document.body) &&
      window.getSelection()?.isCollapsed !== false
    )
      workspaceRef.current?.focus({ preventScroll: true });
  }, [editLifetime, contextReady, contextKey, controller.canEdit, controller.status]);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const focusSerial = useRef(0);
  const focusLifetime =
    JSON.stringify(scope) + controller.authoredIdentity.epoch;
  const focusLifetimeRef = useRef(focusLifetime);
  focusLifetimeRef.current = focusLifetime;
  function focusControl(target: string, selector: string, fallback?: string) {
    const serial = ++focusSerial.current;
    requestAnimationFrame(() => {
      if (
        serial === focusSerial.current &&
        selectedRef.current === target &&
        focusLifetimeRef.current === focusLifetime
      ) {
        const controls = controlsRef.current;
        const field =
          controls?.querySelector<HTMLElement>(selector) ??
          (fallback ? controls?.querySelector<HTMLElement>(fallback) : null);
        for (
          let parent = field?.parentElement;
          parent && parent !== controls;
          parent = parent.parentElement
        )
          if (parent instanceof HTMLDetailsElement) parent.open = true;
        field?.focus();
      }
    });
  }
  function navigate(
    request: Parameters<
      Parameters<typeof useStudioConnectionTask>[0]["navigate"]
    >[0],
  ) {
    ++focusSerial.current;
    if (request.selected !== undefined) setSelected(request.selected);
    if (request.section) choose(request.section);
    if (request.mode) setMode(request.mode);
    if (request.view)
      setView((current) => (current === "Split" ? "Split" : request.view!));
    if (request.focus)
      focusControl(
        request.selected ?? selected,
        request.focus === "House connection" ? "[data-studio-connection]" : `input[aria-label="${request.focus}"]`,
      );
  }
  function applyTask(
    create: Parameters<typeof originalController.transact>[1],
    accepted: (edit: NonNullable<typeof controller.edit>) => void,
  ) {
    // Inspector actions are discrete. Finish this accepted field/method render
    // before the next click uses its current edit and guarded identity.
    flushSync(() => {
      const result = controller.transact(controller.authoredIdentity, create);
      if (result.kind === "accepted") {
        setError(null);
        accepted(result.edit);
      } else setError(result.reason);
    });
  }
  const join = useStudioJoinTask({
    edit,
    identity: controller.authoredIdentity,
    objectId: product?.object.id ?? selected,
    active: mode === "join" && !houseRecord && !!product,
    navigate,
    apply: applyTask,
    change: controller.change,
  });
  const joinDraft = join.draft;
  const houseEditor = useStudioHouseDraft({
    edit,
    resolved,
    selected,
    scope,
    identity: controller.authoredIdentity,
    apply: applyTask,
  });
  const { draft: houseDraft, currentHouse, error: houseError } = houseEditor;
  const connection = useStudioConnectionTask({
    edit,
    resolved,
    identity: controller.authoredIdentity,
    location: { selected, section, mode, view },
    housePending: false,
    navigate,
    apply: applyTask,
  });
  const {
    preview,
    repairContext,
    repairEdge,
    repairMeasurements,
  } = connection;
  const movementLocked =
    mode === "join" ||
    !controller.canEdit;
  const direct = useStudioDirectPlacement({
    edit,
    locked: movementLocked,
    pending: null,
    selectedId: selected,
    session: {
      identity: controller.authoredIdentity,
      transact: controller.transact,
    },
    scene: resolved,
    pendingScene: null,
    onAccepted: () => originalController.endHistoryGroup(),
    onApplied: () => connection.dispatch({ kind: "applied" }),
  });

  const provisional = direct.busy || !!joinDraft;
  const invalid = products.find((p) => p.error),
    price = useStudioWebsitePrice({
      actorId: scope.actorId,
      projectId: scope.projectId,
      estimateId: scope.estimateId,
      designId: edit.designId,
      revision: edit.revision,
      design: null,
      composition: !invalid && !arrangementError ? edit : null,
      openingPrice,
      openingState:!openingPrice?undefined:controller.status==='loading'||!houseEditor.recoveryReady?'waiting':controller.status==='ready'&&!controller.session?.dirty&&!controller.session?.pending&&!controller.retryOnly&&controller.localDurable&&!houseEditor.hasRetainedInput&&!provisional?'eligible':'ineligible',
    });
  const heightError = useMemo(() => {
    if (binding || !product?.value) return null;
    try {
      independentStudioDatum(product.value);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [binding, product?.value]);
  const run = useCallback((action: () => void) => {
    try {
      setError(null);
      action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This change could not be applied.",
      );
    }
  }, []);
  const resetConnectionSelection = connection.resetSelection,
    cancelJoin = join.cancel;
  const pick = useCallback(
    (id: string) => {
      if (id === selection) return;
      propertyUndo.current = null;
      originalController.endHistoryGroup();
      ++focusSerial.current;
      resetConnectionSelection();
      setSelected(id);
      setMode(mode === "position" ? "position" : "options");
      cancelJoin();
      setError(null);
    },
    [
      selection,
      mode,
      resetConnectionSelection,
      cancelJoin,
      originalController.endHistoryGroup,
    ],
  );
  useEffect(() => {
    if (selection !== selected) pick(selected);
  }, [selection, selected, pick]);
  function add() {
    run(() => {
      const id = `${edit.designId}:pergola:${crypto.randomUUID()}`;
      if (controller.change(addWebsitePergola(edit, id)).kind !== "accepted")
        return;
      pick(id);
      choose("Shape");
    });
  }
  function objectAction(kind: "duplicate" | "remove") {
    if (!houseRecord && !product) return;
    run(() => {
      const context = {
        persistedObjectIds: controller.session?.baselinePergolaIds ?? [],
        baselineObjectOptions: controller.session?.baselineObjectOptions,
        savePending: !!controller.session?.pending,
      };
      if (kind === "duplicate") {
        const id = `${edit.designId}:${houseRecord ? "house" : "pergola"}:${crypto.randomUUID()}`;
        if (
          controller.change(
            pasteStudioSceneObject(
              edit,
              copyStudioSceneObject(edit, selected),
              id,
              context,
            ),
          ).kind !== "accepted"
        )
          return;
        pick(id);
        if (!houseRecord) {
          setMode("position");
          setView((current) => (current === "Split" ? "Split" : "Plan"));
        }
        setError(
          "Copy created at the same position. Move the selected copy in Plan.",
        );
        return;
      }
      if (houseRecord) {
        controller.change(removeStudioSceneObject(edit, selected, context));
        return;
      }
      const command = { kind, pergolaId: product!.object.id } as const;
      const result = applyStudioPergolaEdit(edit, command, {
        persistedObjectIds: controller.session?.baselinePergolaIds ?? [],
        baselineObjectOptions: controller.session?.baselineObjectOptions,
        savePending: !!controller.session?.pending,
      });
      if (!result.ok) throw Error(result.message);
      if (controller.change(result.edit).kind !== "accepted") return;
      pick(result.selectedObjectId ?? scene.houses[0]?.id ?? "");
    });
  }
  function dimension(axis: "width" | "projection") {
    setMode("options");
    choose("Shape");
    focusControl(
      selected,
      `input[aria-label="${axis === "width" ? "Width" : "Projection"} in millimetres"]`,
    );
  }
  const invalidSelection = invalid ? studioProductIssue(invalid) : null;
  function repairProductSelection(row: typeof product) {
    const issue = row && studioProductIssue(row);
    if (!row || !issue) return;
    pick(row.object.id);
    setMode("options");
    choose(issue.section);
    focusControl(row.object.id, issue.focus);
  }
  function checkProduct() {
    if (!invalid) return;
    if (invalidSelection) {
      repairProductSelection(invalid);
      return;
    }
    pick(invalid.object.id);
    if (invalid.studioAttachment)
      connection.dispatch({
        kind: "retain-repair",
        selected: invalid.object.id,
      });
    let placement = !!invalid.studioAttachment;
    try {
      if (invalid.value) independentStudioDatum(invalid.value);
    } catch {
      placement = true;
    }
    setMode(placement ? "position" : "options");
    if (!placement) choose("Shape");
  }
  function checkJoin() {
    if (!invalidJoin) return;
    pick(invalidJoin.join.a.objectId);
    setMode("join");
  }
  const change = useCallback(
    (value: StudioWebsiteDesign) => {
      run(() => changeEdit(changeStudioProduct(edit, value)));
    },
    [run, changeEdit, edit],
  );

  const begin = () => connection.dispatch({ kind: "begin" });
  function historyAction(direction: "undo" | "redo") {
    propertyUndo.current = null;
    const result = originalController[direction](selected);
    if (result.kind === "accepted") {
      if (result.selection !== undefined) pick(result.selection);
      setError(null);
      workspaceRef.current?.focus({ preventScroll: true });
    } else setError(result.reason);
  }
  const keyboard = useStudioKeyboard({
    lifetime: editLifetime,
    selected,
    enabled: controller.canEdit && direct.phase === "idle",
    endGroup: originalController.endHistoryGroup,
    perform: (action: StudioShortcut) => {
      try {
        if (action.kind === "undo" || action.kind === "redo") {
          historyAction(action.kind);
          return;
        }
        if (action.kind === "copy") {
          const current = originalController.captureEdit(
            controller.authoredIdentity,
          );
          if (!current)
            throw Error(
              "This selection cannot currently be copied. Your work is kept.",
            );
          const copy = copyStudioSceneObject(current, selected);
          setError("Selection copied.");
          workspaceRef.current?.focus({ preventScroll: true });
          return copy;
        }
        if (houseDraft?.id === selected || (!houseRecord && product?.error))
          throw Error(
            "Finish or discard the selected object's unfinished input first.",
          );
        const context = {
          persistedObjectIds: controller.session?.baselinePergolaIds ?? [],
          baselineObjectOptions: controller.session?.baselineObjectOptions,
          savePending: !!controller.session?.pending,
        };
        const id =
          action.kind === "paste"
            ? `${edit.designId}:${action.copy.kind}:${crypto.randomUUID()}`
            : selected;
        let notice: string | undefined;
        const result = controller.transact(
          controller.authoredIdentity,
          (current) => {
            if (action.kind === "paste")
              return pasteStudioSceneObject(current, action.copy, id, context);
            if (action.kind === "delete")
              return removeStudioSceneObject(current, selected, context);
            const moved = nudgeStudioSceneObject(
              current,
              selected,
              action.dx,
              action.dy,
            );
            notice = moved.notice;
            return moved.edit;
          },
          { group: action.kind === "nudge" ? action.group : undefined },
        );
        if (result.kind !== "accepted") throw Error(result.reason);
        workspaceRef.current?.focus({ preventScroll: true });
        if (action.kind === "paste") {
          pick(id);
          setError(
            "Copy created at the same position. Move the selected copy in Plan.",
          );
        } else {
          setError(notice ?? null);
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "The selection could not be changed.",
        );
      }
    },
  });
  const repairPanel = (issue: string) => (
    <StudioConnectionRepair
      error={issue}
      measurements={repairMeasurements}
      edgeLabel={connection.edgeLabel}
      onHouse={() => connection.dispatch({ kind: "repair", target: "house" })}
      onPergola={() =>
        connection.dispatch({ kind: "repair", target: "pergola" })
      }
      onHighlight={() => connection.dispatch({ kind: "highlight" })}
    />
  );
  const content = (
    <main
      ref={workspaceRef}
      tabIndex={-1}
      onKeyDown={keyboard.onKeyDown}
      className={`${css.page} ${css.editorPage} ${css.cadEditor}`}
      onFocusCapture={(event) => {
        const field = event.target;
        if (
          !houseRecord &&
          field instanceof HTMLInputElement &&
          controlsRef.current?.contains(field) &&
          !["checkbox", "radio", "range", "color", "button", "submit"].includes(
            field.type,
          )
        )
          propertyUndo.current = {
            field,
            lifetime: editLifetime,
            objectId: selected,
            group: crypto.randomUUID(),
          };
      }}
      onBlurCapture={(event) => {
        if (propertyUndo.current?.field === event.target) {
          propertyUndo.current = null;
          originalController.endHistoryGroup();
        }
        keyboard.end();
      }}
      onKeyDownCapture={(event) => {
        if (
          event.key === "Enter" &&
          propertyUndo.current?.field === event.target
        ) {
          propertyUndo.current.group = crypto.randomUUID();
          originalController.endHistoryGroup();
        }
      }}
      onChangeCapture={(event) => {
        propertyChange.current = event.target;
      }}
      onChange={() => {
        propertyChange.current = null;
      }}
      onPointerDownCapture={(event) => {
        keyboard.end();
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement &&
          (active.hasAttribute("data-studio-house-field") ||
            propertyUndo.current?.field === active) &&
          event.target !== active &&
          !(event.target as Element).closest("[data-studio-house-action]")
        ) {
          // SVG acquisition prevents the browser's default blur. Finish this field
          // and render the accepted model/lock before that same pointer-down runs.
          flushSync(() => active.blur());
        }
        if (
          (event.target as Element).closest("[data-studio-keyboard-canvas]") &&
          !(event.target as Element).closest(
            'button,input,select,textarea,summary,a,[contenteditable]:not([contenteditable="false"])',
          )
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
    >
      <header className={css.header}>
        <div>
          <Link prefetch={prefetch}
            className={css.back}
            href={`/staff/projects/${scope.projectId}?tab=estimates`}
          >
            Sanctuary
          </Link>
          <StudioDesignHeading
            identity={identity}
            versionLabel={versionLabel}
            state={
              controller.session?.dirty
                ? "Unsaved changes kept on this device"
                : "Saved design"
            }
          />
        </div>
        <StudioWorkspaceSubtotal
          houseInputNotice={
            houseDraft
              ? (houseEditor.notice ??
                houseError ??
                "Unfinished house input is kept on this device. Showing the last completed model.")
              : null
          }
          provisional={provisional}
          invalid={invalid}
          invalidSelection={invalidSelection}
          invalidJoin={!!invalidJoin}
          arrangementError={arrangementError}
          products={products}
          price={price}
        >
          {houseDraft &&
            selected !== houseDraft.id &&
            !houseEditor.missingTarget && (
              <button
                onClick={() => {
                  pick(houseDraft.id);
                  focusControl(
                    houseDraft.id,
                    '[aria-invalid="true"]',
                    'input[aria-label="Width (mm)"]',
                  );
                }}
              >
                Review house changes
              </button>
            )}
          {!provisional && invalid && (
            <button onClick={checkProduct}>
              {invalidSelection?.label ??
                (invalid.studioAttachment
                  ? "Check connection"
                  : "Check pergola")}
            </button>
          )}
          {!provisional && !invalid && invalidJoin && (
            <button onClick={checkJoin}>Check join</button>
          )}
          {!provisional && !invalid && !invalidJoin && arrangementError && (
            <button
              onClick={() => {
                if (product) pick(product.object.id);
                setMode("position");
                setView((current) => (current === "Split" ? "Split" : "Plan"));
              }}
            >
              Position
            </button>
          )}
          {!provisional && !invalid && !arrangementError && price.error && (
            <button onClick={price.retry}>Retry price</button>
          )}
          {houseEditor.missingTarget && (
            <button onClick={houseEditor.discard}>Discard house changes</button>
          )}
        </StudioWorkspaceSubtotal>
        <div className={css.actions}>
          <button
            disabled={!controller.canUndo || direct.busy}
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={() => historyAction("undo")}
          >
            Undo
          </button>
          <button
            disabled={!controller.canRedo || direct.busy}
            aria-keyshortcuts="Control+Y Meta+Shift+Z"
            onClick={() => historyAction("redo")}
          >
            Redo
          </button>
          <button
            disabled={
              (!controller.canSave &&
                !(
                  houseDraft &&
                  !houseError &&
                  !houseEditor.notice &&
                  controller.canEdit
                )) ||
              !!invalid ||
              provisional
            }
            onClick={() => controller.save()}
          >
            Save design
          </button>
          <Link prefetch={prefetch}
            href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}
          >
            Review &amp; quote →
          </Link>
        </div>
      </header>
      <StudioWebsiteRecovery controller={controller} />
      {direct.message && (
        <p className={css.placementNotice} role="status">
          {direct.message}
        </p>
      )}
      <div className={css.workspace}>
        <section
          className={css.visual}
          aria-label="Whole design model"
          data-studio-keyboard-canvas
        >
          <nav className={css.objectNavigator} aria-label="Design objects">
            {[
              ...resolved.houseRecords.map((record) => ({
                id: record.id,
                label: record.label,
              })),
              ...products.map((p) => ({
                id: p.object.id,
                label: p.object.label,
              })),
            ].map((o) => (
              <button
                key={o.id}
                data-studio-object-choice
                aria-pressed={selected === o.id}
                onClick={() => pick(o.id)}
              >
                {o.label}
              </button>
            ))}
            <button onClick={add}>+ Pergola</button>
            {!resolved.houseRecords.length && (
              <button
                onClick={() =>
                  run(() => {
                    const r = applyStudioHouseEdit(edit.spatial, {
                      kind: "add",
                      id: `${edit.designId}:house:${crypto.randomUUID()}`,
                      label: "House",
                    });
                    if (!r.ok) throw Error(r.message);
                    if (
                      controller.change({ ...edit, spatial: r.spatial })
                        .kind !== "accepted"
                    )
                      return;
                    if (r.houseFormId) pick(r.houseFormId);
                  })
                }
              >
                + House
              </button>
            )}
          </nav>
          <Scene
            resolvedScene={resolved}
            sceneGeneration={controller.session?.generation}
            gesturePhase={direct.phase}
            repairTarget={
              repairEdge ??
              (!house &&
              (preview.error ||
                (product?.error && !studioProductIssue(product)))
                ? repairMeasurements?.target
                : undefined)
            }
            cameraStorageKey={`${contextKey}:camera`}
            persistentViewport
            cad
            showMeasurements={false}
            refinedHouse
            directDrag={direct.directDrag}
            directFootprint={direct.footprint}
            view={view}
            onView={setView}
            edit={edit}
            selected={selected}
            onSelect={pick}
            section={section}
            placement={mode !== "options"}
            movementLocked={movementLocked}
            joinProjection={join.canvas}
            onJoinTarget={(id, edge) =>
              join.dispatch({ kind: "target", id, edge })
            }
            onDimension={dimension}
            preview={
              direct.busy ? null : joinDraft ? join.preview.edit : null
            }
            previewLabel={direct.proposal?.message}

          />
        </section>
        <fieldset
          ref={controlsRef}
          className={`${css.controls} ${css.houseWorkspaceControls}`}
          disabled={!controller.canEdit}
        >
          <div className={`${css.objectHeading} ${css.houseObjectHeading}`}>
            <strong>{house?.label ?? product?.object.label}</strong>
            <StudioObjectMenu>
              {houseRecord && (
                <>
                  <button onClick={() => objectAction("duplicate")}>
                    Duplicate house
                  </button>
                  <button onClick={() => objectAction("remove")}>
                    Remove house
                  </button>
                </>
              )}
              {!house && product && (
                <>
                  <button
                    onClick={() => {
                      connection.dispatch({ kind: "cancel" });
                      join.cancel();
                      setMode("options");
                    }}
                  >
                    Design choices
                  </button>
                  <button
                    onClick={() => {
                      connection.dispatch({ kind: "cancel" });
                      join.cancel();
                      setMode("position");
                      setView((current) =>
                        current === "Split" ? "Split" : "Plan",
                      );
                    }}
                  >
                    Position & height
                  </button>
                  <button onClick={begin}>
                    {binding ? "Change house connection" : "Attach to house"}
                  </button>
                  <button
                    onClick={() => {
                      connection.dispatch({ kind: "cancel" });
                      setMode("join");
                    }}
                  >
                    Pergola joins
                  </button>
                  <button onClick={() => objectAction("duplicate")}>
                    Duplicate pergola
                  </button>
                  <button onClick={() => objectAction("remove")}>
                    Remove pergola
                  </button>
                </>
              )}
              <details>
                <summary>View controls</summary>
                <p>
                  3D: right-drag to orbit, middle-drag to pan, scroll to zoom.
                  Left-click selects or edits an opening.
                </p>
                <p>
                  Plan: drag an object to move it, right-drag to pan, scroll to
                  zoom. A click selects without moving.
                </p>
                <p>
                  Touch: drag an object in Plan. In 3D, one finger orbits and
                  two fingers pan or zoom. Fit restores the visible view or both
                  Split panes.
                </p>
                <p>
                  Selected house or pergola: Ctrl/Cmd+C copies, Ctrl/Cmd+V
                  pastes, Ctrl/Cmd+Z undoes, Ctrl+Y or Cmd+Shift+Z redoes,
                  Delete removes. Arrow keys move 10 mm in Plan world axes;
                  Shift moves 100 mm. Attached pergolas slide along their house
                  edge in the arrow's direction and stay attached. Text fields
                  keep their normal shortcuts.
                </p>
              </details>
              <Link prefetch={prefetch}
                href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}
              >
                Site items & specialist calculator
              </Link>
            </StudioObjectMenu>
          </div>
          {error && !house && mode !== "attachment" && mode !== "position" && (
            <p className={css.fieldError} role="alert">
              {error}
            </p>
          )}
          {repairContext?.note && <p role="status">{repairContext.note}</p>}
          {repairContext && (
            <button
              className={css.quietButton}
              onClick={() => connection.dispatch({ kind: "return" })}
            >
              Return to{" "}
              {
                products.find((p) => p.object.id === repairContext.selected)
                  ?.object.label
              }{" "}
              · {studioContextLabel(repairContext)}
            </button>
          )}
          {houseRecord && !house ? (
            <p className={css.fieldError} role="alert">
              {houseRecord.error} The original house input is retained.
            </p>
          ) : house && currentHouse ? (
            <StudioHouseInspector
              owner={houseEditor}
              applicationError={error}
            />
          ) : mode === "join" && product ? (
            <div className={css.houseJoinTask}>
              <StudioWebsiteJoinControls
                focused
                view={join.panel}
                onIntent={(intent) => run(() => join.dispatch(intent))}
              />
            </div>
          ) : (
            <>
              {mode === "position" && (
                <div className={css.connectionSummary}>
                  {binding ? (
                    <>
                      <button className={css.quietButton} onClick={begin}>
                        Change
                      </button>
                      <button
                        className={css.quietButton}
                        onClick={() =>
                          run(() =>
                            controller.change(
                              detachStudioPergola(
                                edit,
                                product!.object.id,
                                !!product?.error,
                              ),
                            ),
                          )
                        }
                      >
                        {product?.error
                          ? "Detach at retained reference"
                          : "Detach"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className={css.quietButton} onClick={begin}>
                        Attach to house
                      </button>
                    </>
                  )}
                  {product?.error &&
                    !heightError &&
                    (binding && !studioProductIssue(product) ? (
                      repairPanel(product.error)
                    ) : (
                      <p className={css.fieldError} role="alert">
                        {product.error}
                      </p>
                    ))}
                  {error && (
                    <p className={css.fieldError} role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
              {mode === "position" ? (
                <div className={css.inspectorBody}>
                  <p>
                    {binding
                      ? "Position follows the house."
                      : "Exact placement"}
                  </p>
                  {!binding &&
                    product &&
                    (["originXMm", "originYMm", "rotationDeg"] as const).map(
                      (k) => (
                        <label className={css.field} key={k}>
                          {k === "originXMm"
                            ? "X (mm)"
                            : k === "originYMm"
                              ? "Y (mm)"
                              : "Rotation (degrees)"}
                          <StudioCoordinateInput
                            label={
                              k === "originXMm"
                                ? "X (mm)"
                                : k === "originYMm"
                                  ? "Y (mm)"
                                  : "Rotation (degrees)"
                            }
                            value={product.object.position?.[k] ?? "0"}
                            onChange={(raw) =>
                              run(() =>
                                controller.change(
                                  positionWebsitePergola(
                                    edit,
                                    product.object.id,
                                    { [k]: raw },
                                  ),
                                ),
                              )
                            }
                          />
                        </label>
                      ),
                    )}
                  {!binding && product?.value && (
                    <label className={css.field}>
                      Support height (mm)
                      <input
                        aria-label="Support height in millimetres"
                        aria-invalid={!!heightError}
                        aria-describedby={
                          heightError ? "studio-height-error" : undefined
                        }
                        value={product.value.supportDatumMm ?? "2400"}
                        onChange={(e) =>
                          change({
                            ...product.value!,
                            supportDatumMm: e.target.value,
                          })
                        }
                      />
                      <span>
                        Reference underside; roof shape determines actual post
                        lengths.
                      </span>
                      {heightError && (
                        <span
                          id="studio-height-error"
                          className={css.fieldError}
                        >
                          {heightError}
                        </span>
                      )}
                    </label>
                  )}
                  {product && (
                    <button className={css.quietButton} onClick={() => setMode("options")}>Back to design</button>
                  )}
                  {product && (
                    <button
                      className={css.quietButton}
                      onClick={() => {
                        connection.dispatch({ kind: "cancel" });
                        setMode("join");
                      }}
                    >
                      Pergola joins
                      {joins.some(
                        (s) =>
                          s.join.a.objectId === product.object.id ||
                          s.join.b.objectId === product.object.id,
                      )
                        ? " · view or repair"
                        : ""}
                    </button>
                  )}
                </div>
              ) : (
                product?.value && (
                  <StudioWebsiteControls
                    value={product.value}
                    onChange={change}
                    onModelPreview={() =>
                      setView((current) =>
                        current === "Split" ? "Split" : "3D",
                      )
                    }
                    onPlanPreview={() =>
                      setView((current) =>
                        current === "Split" ? "Split" : "Plan",
                      )
                    }
                    section={section}
                    choose={(next) => { connection.dispatch({kind: "cancel"}); choose(next); }}
                    connectionControls={<StudioHouseConnectionControls task={connection} product={product} onProductRepair={()=>repairProductSelection(product)} />}
                    onDesignRepair={() =>
                      focusControl(
                        selected,
                        "[data-studio-roof-options] > summary",
                      )
                    }
                    bookmarkKey={`${scope.actorId}:${edit.designId}:${product.object.id}:sides`}
                  />
                )
              )}
            </>
          )}
        </fieldset>
      </div>
    </main>
  );
  const shown = products.find(
    (p) => p.object.id === product?.object.id,
  );
  const display = useMemo(
      () => (shown ? studioDisplayProduct(shown) : null),
      [shown],
    ),
    d = display?.design,
    preparedGeometry = resolved.products.find(
      (p) => p.object.id === product?.object.id,
    )?.geometry ?? null;
  const changeRoof = useCallback(
    (roof: StudioWebsiteDesign["selection"]["roof"]) => {
      if (!house && mode === "options" && product?.value)
        change({
          ...product.value,
          selection: { ...product.value.selection, roof },
        });
    },
    [house, mode, product?.value, change],
  );
  const chooseSides = useCallback(() => {
    if (!house && mode === "options") choose("Sides");
  }, [house, mode, choose]);
  if (!d) return content;
  return (
    <LightingProvider
      input={d.input}
      roof={d.roof}
      geometryOptions={display.geometryOptions}
      preparedGeometry={preparedGeometry}
      onChange={changeRoof}
    >
      <PreviewBlindProvider
        input={d.input}
        roof={d.roof}
        geometryOptions={display.geometryOptions}
        preparedGeometry={preparedGeometry}
        onChange={changeRoof}
        onChooseSides={chooseSides}
      >
        <StudioHouseProductNavigation
          optionsActive={!house && mode === "options"}
          storageKey={`${contextKey}:product:${encodeURIComponent(product.object.id)}`}
          section={section}
          choose={choose}
        />
        {content}
      </PreviewBlindProvider>
    </LightingProvider>
  );
}
