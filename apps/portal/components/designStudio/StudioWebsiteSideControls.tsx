"use client";
import {
  readStudioSideBookmark,
  restoreStudioSideBookmark,
} from "./studioViewContext";
import { useEffect, useState } from "react";
import {
  usePreviewBlinds,
  useSideLookComparison,
} from "@sp/configurator/react/controls";
import {
  applySideTreatment,
  BLIND_FABRICS,
  BLIND_COVERS,
  type SidePanel,
  TIMBER_PROFILES,
  ALUMINIUM_PROFILES,
  defaultSideGap,
} from "@sp/configurator/website";
import { blindUnavailable } from "@sp/configurator/geometry";
import type { StudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import Gap from "./StudioWebsiteGap";
import {
  changeStudioGap,
  clearStudioGap,
} from "@/lib/designStudio/websiteDesign";
import StudioOpeningPicker from "./StudioOpeningPicker";
import css from "./StudioWebsite.module.css";
export default function StudioWebsiteSideControls({
  value,
  onChange,
  bookmarkKey,
  compact = false,
}: {
  compact?: boolean;
  bookmarkKey: string;
  value: StudioWebsiteDesign;
  onChange: (v: StudioWebsiteDesign) => void;
}) {
  const [targets, setTargets] = useState<string[]>([]),
    [groupKind, setGroupKind] = useState<
      "" | "open" | "blind" | "acrylic" | "timber" | "aluminium"
    >(""),
    [groupIssue, setGroupIssue] = useState("");
  const blinds = usePreviewBlinds()!,
    roof = value.selection.roof;
  useEffect(() => {
    if (compact && !blinds.selected && blinds.openings[0])
      blinds.select(blinds.openings[0].id);
  }, [compact, blinds.selected, blinds.openings, blinds.select]);
  const openingScope = JSON.stringify([
    roof.family,
    roof.orientation,
    roof.attachmentIntent,
    blinds.openings,
  ]);
  const readBookmark = () => {
    try {
      return readStudioSideBookmark(
        sessionStorage.getItem(bookmarkKey),
        value.objectId,
        openingScope,
      );
    } catch {
      return null;
    }
  };
  const [bookmarked, setBookmarked] = useState(() => ({
    key: bookmarkKey,
    scope: openingScope,
    design: readBookmark(),
  }));
  const bookmark =
    bookmarked.key === bookmarkKey && bookmarked.scope === openingScope
      ? bookmarked.design
      : null;
  useEffect(
    () =>
      setBookmarked({
        key: bookmarkKey,
        scope: openingScope,
        design: readBookmark(),
      }),
    [bookmarkKey, openingScope],
  );
  const changeRoof = (next: typeof roof) =>
    onChange({ ...value, selection: { ...value.selection, roof: next } });
  const looks = useSideLookComparison(
    roof,
    blinds.openings,
    changeRoof,
    Object.keys(value.rawGaps ?? {}).some((key) => key !== "roof"),
  );
  const rememberCustom = () => {
    if (looks.isCustom || !bookmark) {
      const snapshot = structuredClone(value);
      setBookmarked({
        key: bookmarkKey,
        scope: openingScope,
        design: snapshot,
      });
      try {
        sessionStorage.setItem(
          bookmarkKey,
          JSON.stringify({ version: 1, openingScope, design: snapshot }),
        );
      } catch {
        /* The current mounted comparison still remains available. */
      }
    }
  };
  const selected = blinds.blinds.find((b) => b.opening === blinds.selected),
    opening = blinds.openings.find((o) => o.id === blinds.selected),
    panel = blinds.panels.find((p) => p.opening === blinds.selected),
    fabric = BLIND_FABRICS.find((f) => f.id === selected?.fabric);
  const unavailableBlinds = blinds.blinds.filter(
    (b) => !blinds.openings.some((o) => o.id === b.opening),
  );
  const orphanPanels = blinds.panels.filter(
    (p) => !blinds.openings.some((o) => o.id === p.opening),
  );
  return (
    <>
      {unavailableBlinds.length > 0 && (
        <section
          tabIndex={-1}
          aria-label="Retained unavailable blinds"
          className={css.unavailableChoices}
        >
          <h2>Blinds needing a new opening</h2>
          <p>
            The roof change removed these openings. Remove a retained blind,
            then choose its new opening below.
          </p>
          {unavailableBlinds.map((blind) => (
            <div className={css.retainedChoice} key={blind.opening}>
              <span>
                {blind.opening.replace(
                  /^(front|left|right|rear)-(\d+)of\d+$/,
                  (_, side: string, index: string) =>
                    side[0].toUpperCase() + side.slice(1) + " " + index,
                )}{" "}
                ·{" "}
                {BLIND_FABRICS.find((f) => f.id === blind.fabric)?.name ??
                  blind.fabric}{" "}
                · {blind.colour}
              </span>
              <button
                onClick={() =>
                  blinds.update(
                    blinds.blinds.filter(
                      (item) => item.opening !== blind.opening,
                    ),
                  )
                }
              >
                Remove blind
              </button>
            </div>
          ))}
        </section>
      )}
      {compact ? (
        <StudioOpeningPicker
          openings={blinds.openings}
          selected={blinds.selected}
          onSelect={blinds.select}
        />
      ) : (
        <>
          <h2>
            {blinds.openings.find((o) => o.id === blinds.selected)?.label ??
              "Choose a side"}
          </h2>
          <div className={css.openings}>
            {blinds.openings.map((o) => (
              <button
                key={o.id}
                aria-pressed={blinds.selected === o.id}
                onClick={() => blinds.select(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
      {!blinds.selected ? (
        <p>Choose an opening on the model or above.</p>
      ) : (
        <>
          {compact ? (
            <label className={css.field}>
              {opening?.label ?? "Selected opening"} side
              <select
                aria-label="Selected opening treatment"
                value={panel?.kind ?? (selected ? "blind" : "open")}
                onChange={(event) =>
                  blinds.setKind(
                    event.target.value as
                      | "open"
                      | "blind"
                      | "acrylic"
                      | "timber"
                      | "aluminium",
                  )
                }
              >
                {(
                  ["open", "blind", "acrylic", "timber", "aluminium"] as const
                ).map((kind) => (
                  <option
                    key={kind}
                    value={kind}
                    disabled={
                      kind === "blind" &&
                      !!(opening && blindUnavailable(opening))
                    }
                  >
                    {kind === "blind"
                      ? "Blind"
                      : kind[0].toUpperCase() + kind.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className={css.optionGrid}>
              {(
                ["open", "blind", "acrylic", "timber", "aluminium"] as const
              ).map((kind) => (
                <button
                  key={kind}
                  disabled={
                    kind === "blind" && !!(opening && blindUnavailable(opening))
                  }
                  aria-pressed={
                    (panel?.kind ?? (selected ? "blind" : "open")) === kind
                  }
                  onClick={() => blinds.setKind(kind)}
                >
                  {kind === "blind"
                    ? "Blind"
                    : kind[0].toUpperCase() + kind.slice(1)}
                </button>
              ))}
            </div>
          )}
          {opening && blindUnavailable(opening) && (
            <p>{blindUnavailable(opening)}</p>
          )}
          {panel && (
            <Panel
              panel={panel}
              raw={value.rawGaps?.[panel.opening]}
              onRaw={(raw) =>
                onChange(changeStudioGap(value, panel.opening, raw))
              }
              onChange={(next, resetRaw) => {
                const cleared = resetRaw
                  ? clearStudioGap(value, panel.opening)
                  : value;
                onChange({
                  ...cleared,
                  selection: {
                    ...cleared.selection,
                    roof: {
                      ...roof,
                      sidePanels: blinds.panels.map((p) =>
                        p.opening === next.opening ? next : p,
                      ),
                    },
                  },
                });
              }}
            />
          )}
          {selected && (
            <>
              <label className={css.field}>
                Fabric
                <select
                  value={selected.fabric}
                  onChange={(e) => {
                    const f = BLIND_FABRICS.find(
                      (f) => f.id === e.target.value,
                    )!;
                    blinds.update(
                      blinds.blinds.map((b) =>
                        b.opening === selected.opening
                          ? {
                              ...b,
                              fabric: f.id,
                              colour: f.colours.split("|")[0],
                            }
                          : b,
                      ),
                    );
                  }}
                >
                  {BLIND_FABRICS.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      disabled={!!(opening && blindUnavailable(opening, f.id))}
                    >
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={css.field}>
                Colour
                <select
                  value={selected.colour}
                  onChange={(e) =>
                    blinds.update(
                      blinds.blinds.map((b) =>
                        b.opening === selected.opening
                          ? { ...b, colour: e.target.value }
                          : b,
                      ),
                    )
                  }
                >
                  {fabric?.colours.split("|").map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={css.field}>
                Cover
                <select
                  value={selected.cover}
                  onChange={(e) =>
                    blinds.update(
                      blinds.blinds.map((b) =>
                        b.opening === selected.opening
                          ? { ...b, cover: e.target.value as typeof b.cover }
                          : b,
                      ),
                    )
                  }
                >
                  {BLIND_COVERS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={css.field}>
                Blind position
                <input
                  aria-label="Blind lowered percentage"
                  type="range"
                  min="0"
                  max="100"
                  value={selected.lowered}
                  onChange={(e) =>
                    blinds.update(
                      blinds.blinds.map((b) =>
                        b.opening === selected.opening
                          ? { ...b, lowered: Number(e.target.value) }
                          : b,
                      ),
                    )
                  }
                />
              </label>
              {opening && opening.headerDepth > 0 && (
                <label className={css.check}>
                  <input
                    type="checkbox"
                    checked={selected.infill}
                    onChange={(e) =>
                      blinds.update(
                        blinds.blinds.map((b) =>
                          b.opening === selected.opening
                            ? { ...b, infill: e.target.checked }
                            : b,
                        ),
                      )
                    }
                  />
                  Acrylic infill above header
                </label>
              )}
              <button
                className={css.quietButton}
                disabled={blinds.blinds.length < 2}
                onClick={() => {
                  const targets = blinds.blinds.filter((b) => {
                    const o = blinds.openings.find((o) => o.id === b.opening);
                    return o && !blindUnavailable(o, selected.fabric);
                  });
                  blinds.update(
                    blinds.blinds.map((b) =>
                      targets.some((t) => t.opening === b.opening)
                        ? {
                            ...b,
                            fabric: selected.fabric,
                            colour: selected.colour,
                            cover: selected.cover,
                          }
                        : b,
                    ),
                  );
                }}
              >
                Copy this finish to{" "}
                {blinds.blinds
                  .flatMap((b) => {
                    const o = blinds.openings.find((o) => o.id === b.opening);
                    return o && !blindUnavailable(o, selected.fabric)
                      ? [o.label]
                      : [];
                  })
                  .join(", ")}
              </button>{" "}
            </>
          )}
        </>
      )}
      {orphanPanels.map((p) => (
        <div
          tabIndex={-1}
          aria-label="Retained unavailable sides"
          className={css.retainedChoice}
          key={p.opening}
        >
          <span>Retained {p.kind} screen · opening unavailable</span>
          <button
            onClick={() =>
              changeRoof({
                ...roof,
                sidePanels: roof.sidePanels?.filter(
                  (item) => item.opening !== p.opening,
                ),
              })
            }
          >
            Remove screen
          </button>
        </div>
      ))}
      <details className={css.optionGroup}>
        <summary>Side groups</summary>
        {blinds.openings.map((o) => (
          <label className={css.check} key={o.id}>
            <input
              type="checkbox"
              checked={targets.includes(o.id)}
              onChange={(e) => {
                setGroupKind("");
                setTargets(
                  e.target.checked
                    ? [...targets, o.id]
                    : targets.filter((id) => id !== o.id),
                );
              }}
            />
            {o.label}
          </label>
        ))}
        <label className={css.field}>
          Finish
          <select
            value={groupKind}
            disabled={!targets.length}
            onChange={(e) => {
              const kind = e.target.value as typeof groupKind;
              setGroupKind(kind);
              if (!targets.length || !kind) return;
              const result = applySideTreatment(
                roof,
                blinds.openings,
                targets,
                kind,
              );
              setGroupIssue(result.issues.join(" "));
              if (!result.issues.length) changeRoof(result.roof);
            }}
          >
            <option value="" disabled>
              Choose a finish
            </option>
            {(["open", "blind", "acrylic", "timber", "aluminium"] as const).map(
              (k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ),
            )}
          </select>
        </label>
        <p>
          Targets:{" "}
          {blinds.openings
            .filter((o) => targets.includes(o.id))
            .map((o) => o.label)
            .join(", ") || "Choose openings above"}
        </p>
        {groupIssue && <p role="alert">{groupIssue}</p>}
      </details>
      <details className={css.optionGroup}>
        <summary>Compare side looks</summary>
        <p>
          Applies to {blinds.openings.map((o) => o.label).join(", ")}. Your
          custom look is kept while comparing this layout.
        </p>
        <div className={css.openings}>
          {looks.looks.map((look) => (
            <button
              key={look.id}
              onClick={() => {
                rememberCustom();
                changeRoof(look.roof);
              }}
            >
              {look.name}
            </button>
          ))}
        </div>
        {bookmark && (
          <button
            className={css.quietButton}
            onClick={() => {
              if (bookmark)
                onChange(restoreStudioSideBookmark(value, bookmark));
            }}
          >
            Restore custom sides
          </button>
        )}
        <button
          className={css.quietButton}
          onClick={() => {
            rememberCustom();
            looks.flipPrivacy();
          }}
        >
          Move privacy side
        </button>
      </details>
    </>
  );
}
function Panel({
  panel: p,
  raw,
  onRaw,
  onChange,
}: {
  panel: SidePanel;
  raw?: string;
  onRaw: (raw: string) => void;
  onChange: (p: SidePanel, resetRaw: boolean) => void;
}) {
  const change = (patch: Partial<SidePanel>) => {
    const next = { ...p, ...patch };
    if (!next.customGap) next.gap = defaultSideGap(next.profile, next.edge);
    onChange(
      next,
      Object.hasOwn(patch, "profile") ||
        Object.hasOwn(patch, "edge") ||
        Object.hasOwn(patch, "customGap"),
    );
  };
  return (
    <>
      {p.kind === "acrylic" && (
        <>
          <label className={css.field}>
            Acrylic framing
            <select
              value={p.frame}
              onChange={(e) =>
                change({ frame: Number(e.target.value) as 50 | 100 })
              }
            >
              <option value={50}>50 × 50 mm</option>
              <option value={100}>100 × 50 mm</option>
            </select>
          </label>
          <label className={css.check}>
            <input
              type="checkbox"
              checked={p.battens}
              onChange={(e) => change({ battens: e.target.checked })}
            />
            Horizontal timber battens
          </label>
        </>
      )}
      {(p.kind !== "acrylic" || p.battens) && (
        <>
          {p.kind !== "aluminium" && (
            <label className={css.field}>
              Timber
              <select
                value={p.species ?? "cedar"}
                onChange={(e) =>
                  change({ species: e.target.value as "cedar" | "thermopine" })
                }
              >
                <option value="thermopine">ThermoPine</option>
                <option value="cedar">Cedar</option>
              </select>
            </label>
          )}
          {p.kind !== "acrylic" && (
            <label className={css.field}>
              Direction
              <select
                value={p.direction ?? "horizontal"}
                onChange={(e) =>
                  change({
                    direction: e.target.value as "horizontal" | "vertical",
                  })
                }
              >
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </label>
          )}
          <label className={css.field}>
            Slat size
            <select
              value={p.profile}
              onChange={(e) =>
                change({
                  profile: e.target.value,
                  edge: ["50x10", "39x39"].includes(e.target.value)
                    ? false
                    : p.edge,
                })
              }
            >
              {(p.kind === "aluminium"
                ? ALUMINIUM_PROFILES
                : TIMBER_PROFILES
              ).map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {!["39x39", "50x10"].includes(p.profile) && (
            <label className={css.check}>
              <input
                type="checkbox"
                checked={p.edge}
                onChange={(e) => change({ edge: e.target.checked })}
              />
              Narrow edge facing out
            </label>
          )}
          <Gap
            key={p.opening + p.profile + String(p.customGap)}
            value={p.gap}
            raw={raw}
            onChange={onRaw}
          />
          <button
            className={css.quietButton}
            disabled={!p.customGap && raw === undefined}
            onClick={() => change({ customGap: false })}
          >
            Use profile default
          </button>
        </>
      )}
    </>
  );
}
