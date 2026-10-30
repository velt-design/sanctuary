"use client";
import {StudioDocumentContext} from './StudioDocumentContext';
import { useContext, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  LightingProvider,
  PreviewBlindProvider,
  useLighting,
  usePreviewBlinds,
} from "@sp/configurator/react/controls";
import {
  parseStudioWebsiteDesign,
  resolveStudioWebsiteDesign,
  type StudioWebsiteDesign,
} from "@/lib/designStudio/websiteDesign";
import type { StudioAuthoringView } from "@/lib/designStudio/authoringView";
import type { StudioSaveScope } from "@/lib/designStudio/saveTransport";
import type { StudioDesignIdentity } from "@/lib/designStudio/studioDesignIdentity";
import type { useStudioEditingSession } from "./useStudioEditingSession";
import { websiteComposition } from "@/lib/designStudio/websiteComposition";
import {
  studioViewContextKey,
  readWebsiteViewContext,
  type WebsiteViewContext,
} from "./studioViewContext";
import { useStudioWebsitePrice } from "./useStudioWebsitePrice";
import StudioDesignHeading from "./StudioDesignHeading";
import StudioWebsiteRecovery from "./StudioWebsiteRecovery";
import StudioWebsiteObjectNavigator from "./StudioWebsiteObjectNavigator";
import css from "./StudioWebsite.module.css";
const Scene = dynamic(() => import("./StudioWebsiteScene"), {
  ssr: false,
  loading: () => <p>Preparing your design…</p>,
});
const noop = () => {};

/** Only the null-edit saved-data surface. It owns local viewing state, never an
 * alternate authoring session or commands. Ready/read-only edits use Workspace. */
export default function StudioWebsiteSavedView({
  controller,
  scope,
  view,
  versionLabel,
  identity,
}: {
  controller: ReturnType<typeof useStudioEditingSession>;
  scope: StudioSaveScope;
  view: StudioAuthoringView;
  versionLabel: string;
  identity?: StudioDesignIdentity;
}) {
  const prefetch=useContext(StudioDocumentContext)?false:undefined;
  const [section, choose] = useState<WebsiteViewContext["section"]>("Shape");
  const [selectedId, select] = useState<string | null>(null);
  const key = studioViewContextKey(scope);
  useEffect(() => {
    try {
      select(sessionStorage.getItem(`${key}:selected`));
    } catch {}
  }, [key]);
  function pick(id: string) {
    select(id);
    try {
      sessionStorage.setItem(`${key}:selected`, id);
    } catch {}
  }
  const saved = useMemo(() => {
    try {
      return { rows: websiteComposition(view), error: null };
    } catch (error) {
      return {
        rows: [],
        error:
          error instanceof Error
            ? error.message
            : "The saved design preview is unavailable.",
      };
    }
  }, [view]);
  const composition = saved.rows;
  const selectedHouse = view.spatial.houseAssembly?.houseForms.find(
    (h) => h.id === selectedId,
  );
  const selected =
    composition.find((p) => p.object.id === selectedId) ?? composition[0];
  const row = view.objectOptions.find(
    (row) => row.objectId === selected?.object.id,
  );
  const parsed = useMemo(
    () => parseStudioWebsiteDesign(row?.values.websiteDesign, row?.objectId),
    [row],
  );
  const value = parsed.ok ? parsed.value : null;
  const resolved = useMemo(
    () => (value ? resolveStudioWebsiteDesign(value, value.objectId) : null),
    [value],
  );
  const selection = resolved?.ok ? resolved.value : value?.selection;
  const compositionMode =
    composition.length > 1 ||
    Boolean(view.spatial.houseAssembly) ||
    composition.some(
      (p) => p.value?.supportDatumMm !== undefined || p.object.attachment?.host,
    );
  const price = useStudioWebsitePrice({
    actorId: scope.actorId,
    projectId: scope.projectId,
    estimateId: scope.estimateId,
    designId: view.designId,
    revision: view.revision,
    design: resolved?.ok && !compositionMode ? value : null,
    composition: null,
  });
  const invalidAttachment = composition.find(
    (p) => p.error && p.object.attachment?.host,
  );
  const workspace = (
    <main className={`${css.page} ${css.editorPage}`}>
      <header className={css.header}>
        <div>
          <Link prefetch={prefetch}
            className={css.back}
            href={`/staff/projects/${scope.projectId}?tab=estimates`}
          >
            ← Project
          </Link>
          <StudioDesignHeading
            identity={identity}
            versionLabel={versionLabel}
            state="Saved design"
          />
          <StudioWebsiteRecovery controller={controller} />
        </div>
        <div className={css.price} aria-live="polite">
          <span>Design subtotal · including GST</span>
          <strong>
            {saved.error
              ? "Check design"
              : !value
                ? "Not calculated"
                : composition.some((p) => p.error)
                  ? "Check design"
                  : price.price?.status === "priced"
                    ? new Intl.NumberFormat("en-NZ", {
                        style: "currency",
                        currency: "NZD",
                        maximumFractionDigits: 0,
                      }).format(price.price.amount!)
                    : resolved && !resolved.ok
                      ? "Check design"
                      : price.error || price.price?.status === "unavailable"
                        ? "Unavailable"
                        : "Calculating…"}
          </strong>
          <small>
            {saved.error ??
              (!value
                ? "Add a pergola to calculate the design."
                : composition.find((p) => p.error)?.error ||
                  (resolved && !resolved.ok ? resolved.message : null) ||
                  price.error ||
                  price.price?.reason ||
                  (price.price?.versionNumber
                    ? `Current Pricebook ${price.price.versionNumber}`
                    : " "))}
            {resolved && !resolved.ok && (
              <FixInput issue={resolved} choose={choose} />
            )}
            {invalidAttachment && (
              <button onClick={() => pick(invalidAttachment.object.id)}>
                Check attachment
              </button>
            )}
            {price.error && <button onClick={price.retry}>Retry price</button>}
          </small>
        </div>
        <div className={css.actions}>
          <button disabled>Save design</button>
          <Link prefetch={prefetch}
            href={`/staff/design-studio/${scope.projectId}/${scope.estimateId}`}
          >
            Review &amp; quote →
          </Link>
        </div>
      </header>
      <div className={css.workspace}>
        <section className={css.visual} aria-label="Whole design model">
          <StudioWebsiteObjectNavigator
            objects={[
              ...view.spatial.pergolas.map((p) => ({
                id: p.id,
                label: p.label,
              })),
              ...(view.spatial.houseAssembly?.houseForms ?? []).map((h) => ({
                id: h.id,
                label: h.label,
              })),
            ]}
            selected={selectedHouse?.id ?? selected?.object.id ?? null}
            onSelect={pick}
            onAdd={noop}
            onHouse={noop}
            disabled
          />
          {resolved?.ok && selection ? (
            <Scene design={selection} section={section} />
          ) : (
            <div
              className={css.sceneError}
              role={saved.error ? "alert" : undefined}
            >
              {saved.error ??
                (resolved?.ok === false
                  ? resolved.message
                  : "Add a pergola to begin.")}
            </div>
          )}
          {!compositionMode && selection && (
            <WebsiteDimensions design={selection} />
          )}
        </section>
        <fieldset className={css.controls} disabled>
          <div className={css.objectHeading}>
            <strong>{selectedHouse?.label ?? selected?.object.label}</strong>
          </div>
          <div className={css.inspectorBody} role="status">
            Opening your saved choices…
          </div>
        </fieldset>
      </div>
    </main>
  );
  if (!value || !selection) return workspace;
  return (
    <LightingProvider
      input={selection.input}
      roof={selection.roof}
      geometryOptions={selected?.geometryOptions}
      onChange={noop}
    >
      <PreviewBlindProvider
        input={selection.input}
        roof={selection.roof}
        geometryOptions={selected?.geometryOptions}
        onChange={noop}
        onChooseSides={() => choose("Sides")}
      >
        <WebsiteNavigation
          storageKey={`${key}:website:v1:${value.objectId}`}
          globalKey={`${key}:composition-view`}
          section={section}
          choose={choose}
        />
        {workspace}
      </PreviewBlindProvider>
    </LightingProvider>
  );
}

function WebsiteNavigation({
  storageKey,
  globalKey,
  section,
  choose,
}: {
  storageKey: string;
  globalKey: string;
  section: WebsiteViewContext["section"];
  choose: (section: WebsiteViewContext["section"]) => void;
}) {
  const light = useLighting()!,
    blinds = usePreviewBlinds()!;
  const [restored, setRestored] = useState<string | null>(null);
  const [globalRestored, setGlobalRestored] = useState(false);
  useEffect(() => {
    try {
      const context = JSON.parse(sessionStorage.getItem(globalKey) ?? "null");
      if (context) {
        if (context.view === "Plan" || context.view === "3D")
          light.setView(context.view);
        if (typeof context.night === "boolean") light.setNight(context.night);
      }
    } catch {}
    setGlobalRestored(true);
  }, [globalKey]);
  useEffect(() => {
    if (globalRestored)
      try {
        sessionStorage.setItem(
          globalKey,
          JSON.stringify({ view: light.view, night: light.night }),
        );
      } catch {}
  }, [globalKey, globalRestored, light.view, light.night]);
  useEffect(() => {
    try {
      const context = readWebsiteViewContext(
        sessionStorage.getItem(storageKey),
        blinds.openings.map((o) => o.id),
      );
      if (context) {
        choose(context.section);
        if (context.section === "Lighting") light.open();
        if (context.opening) blinds.select(context.opening);
        light.setTool(context.tool ?? null);
      }
    } catch {
      /* Optional navigation state must not block design editing. */
    }
    setRestored(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (restored !== storageKey) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          section,
          night: light.night,
          opening: blinds.selected,
          view: light.view,
          tool: light.tool,
        }),
      );
    } catch {
      /* Keep current work usable without navigation storage. */
    }
  }, [
    storageKey,
    restored,
    section,
    light.night,
    blinds.selected,
    light.view,
    light.tool,
  ]);
  return null;
}

function WebsiteDimensions({
  design,
}: {
  design: StudioWebsiteDesign["selection"];
}) {
  const lighting = useLighting();
  return (
    <div className={css.dimensions} data-night={lighting?.night || undefined}>
      {design.input.widthMm / 1000} × {design.input.projectionMm / 1000} m
      <span>
        {design.roof.family === "mono"
          ? "Pitched"
          : design.roof.family === "gable"
            ? "Gable"
            : "Box perimeter"}
      </span>
    </div>
  );
}

function FixInput({
  issue,
  choose,
}: {
  issue: { message: string; field?: string; gapKey?: string };
  choose: (s: WebsiteViewContext["section"]) => void;
}) {
  const blinds = usePreviewBlinds()!;
  return (
    <button
      onClick={() => {
        const section =
          issue.field === "gap"
            ? issue.gapKey === "roof"
              ? "Roof"
              : "Sides"
            : "Shape";
        choose(section);
        if (section === "Sides" && issue.gapKey) blinds.select(issue.gapKey);
      }}
    >
      Fix {issue.field === "gap" ? "gap" : "input"}
    </button>
  );
}
