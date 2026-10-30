"use client";
import { useLighting } from "@sp/configurator/react/controls";
import { layoutRafterLights } from "@sp/geometry";
import {
  cedarSections,
  cedarOptions,
  sharedCedarOptions,
  perimeterLedPreset,
  effectiveLightingLayout,
} from "@sp/configurator/website";
import css from "./StudioWebsite.module.css";
export default function StudioWebsiteLightingControls({
  compact = false,
  onChoosePlan,
  onDesign,
}: {
  compact?: boolean;
  onChoosePlan?: () => void;
  onDesign?: () => void;
} = {}) {
  const w = useLighting()!;
  const tool = w.tool ?? "rafter";
  const effective = effectiveLightingLayout(w.sites, w.value).selection;
  const sections = cedarSections(w.sites.cedar);
  const missingStrips = w.value.strips.filter(
    (id) => !w.sites.strips.some((s) => s.id === id),
  );
  const missingSections = Object.keys(w.value.cedarOverrides ?? {}).filter(
    (id) => !sections.includes(id),
  );
  const grid = (section?: string) => {
    const selected = section
      ? w.value.cedarOverrides?.[section]
      : {
          count: w.value.cedarPerSection ?? 0,
          pattern: w.value.cedarPattern ?? "rows2",
        };
    const options = section
      ? cedarOptions(w.sites.cedar, section)
      : sharedCedarOptions(w.sites.cedar);
    const set = (count: number, pattern: "rows2" | "rows3") =>
      w.change(
        section
          ? {
              ...w.value,
              cedarOverrides: {
                ...w.value.cedarOverrides,
                [section]: { count, pattern },
              },
            }
          : { ...w.value, cedarPerSection: count, cedarPattern: pattern },
      );
    return (
      <div
        className={css.optionGrid}
        role="group"
        aria-label={section ?? "All ceiling sections"}
      >
        <button aria-pressed={!selected?.count} onClick={() => set(0, "rows2")}>
          Off
        </button>
        {options.map((o) => (
          <button
            key={o.count + o.pattern}
            aria-pressed={
              selected?.count === o.count && selected.pattern === o.pattern
            }
            onClick={() => set(o.count, o.pattern)}
          >
            {o.count} lights
            <small className={css.choiceDetail}>
              {o.count === 2
                ? "Centred pair"
                : o.pattern === "rows2"
                  ? "Rows of 2"
                  : "Rows of 3"}
            </small>
          </button>
        ))}
        {!options.length && <p>No complete grid fits this section.</p>}
      </div>
    );
  };
  const rafters = (
      <>
        <h3>Rafter lights</h3>
        <div className={css.choices}>
          {(["off", "low", "medium", "high"] as const).map((amount) => {
            const count = layoutRafterLights(w.sites.rafters, amount).length;
            return (
              <button
                key={amount}
                disabled={amount !== "off" && !count}
                aria-pressed={(w.value.rafterAmount ?? "off") === amount}
                onClick={() =>
                  w.change({
                    ...w.value,
                    rafterAmount: amount,
                    rafterCount: count,
                  })
                }
              >
                {amount[0].toUpperCase() + amount.slice(1)}
                <small className={css.choiceDetail}>{count} lights</small>
              </button>
            );
          })}
        </div>
        {!w.sites.rafters.length && (
          <div>
            <p role="status">{w.rafterUnavailableReason}</p>
            {onDesign && (
              <button className={css.quietButton} onClick={onDesign}>
                Open Design roof options
              </button>
            )}
          </div>
        )}
      </>
    ),
    strips = (
      <>
        <h3>LED layout</h3>
        <div className={css.openings}>
          {[
            "Outer perimeter",
            "Alternate rafters",
            "All rafters",
            "Clear strips",
          ].map((label, i) => (
            <button
              key={label}
              disabled={
                (i === 1 || i === 2) && !w.sites.strips.some((s) => s.rafter)
              }
              onClick={() =>
                w.change({
                  ...w.value,
                  strips:
                    i === 0
                      ? perimeterLedPreset(w.sites.strips)
                      : i === 1
                        ? w.sites.strips
                            .filter((s) => s.rafter)
                            .filter((_, n) => n % 2 === 0)
                            .map((s) => s.id)
                        : i === 2
                          ? w.sites.strips
                              .filter((s) => s.rafter)
                              .map((s) => s.id)
                          : [],
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        {!w.sites.strips.some((s) => s.rafter) && (
          <p>
            No rafter LED members are available with this roof finish. Choose
            perimeter beams on the plan.
          </p>
        )}
        <button
          className={css.quietButton}
          onClick={() => {
            w.setTool("strip");
            if (onChoosePlan) onChoosePlan();
            else w.setView("Plan");
          }}
        >
          Choose members on plan
        </button>
        <details>
          <summary>Individual strips</summary>
          {w.sites.strips.map((s) => (
            <label className={css.check} key={s.id}>
              <input
                type="checkbox"
                checked={w.value.strips.includes(s.id)}
                onChange={() => w.toggle(s.id)}
              />
              {s.label}
            </label>
          ))}
        </details>
      </>
    ),
    ceiling = (
      <details
        className={css.designDisclosure}
        open={!compact || (!!sections.length && !w.sites.rafters.length)}
      >
        <summary>Ceiling lights</summary>
        <h3>Ceiling downlights</h3>
        {(w.sites.cedar[0]?.cedarSlopes ?? 1) > 1 && (
          <p>Choose lights per section, per roof slope.</p>
        )}
        {sections.length > 1 && (
          <label className={css.check}>
            <input
              type="checkbox"
              checked={!!w.value.cedarIndividual}
              onChange={(e) =>
                w.change({ ...w.value, cedarIndividual: e.target.checked })
              }
            />
            Adjust sections individually
          </label>
        )}
        {w.value.cedarIndividual
          ? sections.map((s) => (
              <section className={css.optionGroup} key={s}>
                <h3>{s.replace("section-", "Section ")}</h3>
                {grid(s)}
              </section>
            ))
          : grid()}
        <p>
          {effective.cedarCount} downlights across the fitted ceiling areas.
        </p>
      </details>
    );
  return (
    <>
      {!compact && <h2>Lighting</h2>}
      {(missingStrips.length > 0 || missingSections.length > 0) && (
        <section className={css.unavailableChoices}>
          <h3>Retained lights need a location</h3>
          <p>
            {missingStrips.length} LED members and {missingSections.length}{" "}
            ceiling sections no longer exist in this roof. They are kept but not
            included in the displayed layout or subtotal.
          </p>
          <button
            className={css.quietButton}
            onClick={() =>
              w.change({
                ...w.value,
                strips: w.value.strips.filter(
                  (id) => !missingStrips.includes(id),
                ),
                cedarOverrides: Object.fromEntries(
                  Object.entries(w.value.cedarOverrides ?? {}).filter(
                    ([id]) => !missingSections.includes(id),
                  ),
                ),
              })
            }
          >
            Remove unavailable selections
          </button>
        </section>
      )}
      {!compact && (
        <div className={css.choices}>
          {(["rafter", "cedar", "strip"] as const).map((t) => (
            <button
              key={t}
              disabled={t === "cedar" && !sections.length}
              aria-pressed={tool === t}
              onClick={() => w.setTool(t)}
            >
              {t === "rafter" ? "Rafter" : t === "cedar" ? "Ceiling" : "LED"}
              <small className={css.choiceDetail}>
                {t === "rafter"
                  ? effective.rafterCount
                  : t === "cedar"
                    ? effective.cedarCount
                    : w.value.strips.length}{" "}
                {t === "strip" ? "members" : "lights"}
              </small>
            </button>
          ))}
        </div>
      )}
      {compact ? (
        <>
          {sections.length && !w.sites.rafters.length ? (
            <>
              {ceiling}
              {rafters}
              {strips}
            </>
          ) : (
            <>
              {rafters}
              {strips}
              {ceiling}
            </>
          )}
        </>
      ) : (
        <>{tool === "rafter" ? rafters : tool === "strip" ? strips : ceiling}</>
      )}
    </>
  );
}
