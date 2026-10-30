import { CUSTOMER_ACRYLIC_TINT_OPTIONS } from "../core";
import type { WebsiteSubmittedDesignV1 } from "./contracts";
import { isSideOpeningId } from './contract/sideOpening';

type Check = (value: unknown) => boolean;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;
const choice =
  (...values: unknown[]): Check =>
  (v) =>
    values.includes(v);
const integer =
  (min: number, max: number): Check =>
  (v) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
const text =
  (pattern: RegExp): Check =>
  (v) =>
    typeof v === "string" && pattern.test(v);
const bool: Check = (v) => typeof v === "boolean";
function shape(
  required: Record<string, Check>,
  optional: Record<string, Check> = {},
): Check {
  return (v) =>
    object(v) &&
    Object.keys(v).every(
      (k) => Object.hasOwn(required, k) || Object.hasOwn(optional, k),
    ) &&
    Object.entries(required).every(
      ([k, check]) => Object.hasOwn(v, k) && check(v[k]),
    ) &&
    Object.entries(optional).every(
      ([k, check]) => !Object.hasOwn(v, k) || check(v[k]),
    );
}
const list =
  (check: Check, max: number): Check =>
  (v) =>
    Array.isArray(v) &&
    v.length <= max &&
    Array.from(
      { length: v.length },
      (_, i) => Object.hasOwn(v, i) && check(v[i]),
    ).every(Boolean) &&
    Object.keys(v).length === v.length;
const species = choice("cedar", "thermopine");
const opening = isSideOpeningId;
const finish = shape(
  {
    material: choice("acrylic", "solid", "combination"),
    layout: choice("central", "house"),
    profile: choice("corrugated", "trapezoidal", "tray"),
    acrylicBays: integer(1, 16),
    trayWidth: choice(300, 400, 500),
  },
  {
    ceiling: choice(
      "cedar-100",
      "cedar-150",
      "thermopine-100",
      "thermopine-150",
    ),
  },
);
// Catalog combinations and geometric applicability remain with their existing
// owners. This boundary validates exact data shape without rewriting selections.
const blind = shape({
  opening,
  fabric: choice(
    "classic",
    "urban",
    "extreme",
    "one",
    "horizon",
    "lounge",
    "pvc",
  ),
  colour: text(/^[A-Za-z][A-Za-z /-]{0,79}$/),
  cover: choice("NONE", "FLASHING", "PELMET"),
  lowered: integer(0, 100),
  infill: bool,
});
const sidePanel = shape(
  {
    opening,
    kind: choice("acrylic", "timber", "aluminium"),
    profile: choice("39x39", "65x39", "90x39", "50x10", "65x16"),
    edge: bool,
    gap: integer(5, 200),
    customGap: bool,
    frame: choice(50, 100),
    battens: bool,
  },
  { species, direction: choice("horizontal", "vertical") },
);
const battens = shape(
  {
    profile: choice("39x39", "65x39", "90x39"),
    edge: bool,
    gap: integer(5, 200),
    customGap: bool,
  },
  { species },
);
const pattern = choice("rows2", "rows3");
const count = choice(0, 2, 4, 6, 9);
const layout = choice("even", "central", "perimeter");
const override = shape({ count, pattern });
const lighting = shape(
  {
    rafterCount: integer(0, 200),
    cedarCount: integer(0, 200),
    rafterLayout: layout,
    cedarLayout: layout,
    strips: list(text(/^[a-zA-Z0-9_.:-]{1,120}$/), 150),
  },
  {
    cedarPerSection: count,
    cedarIndividual: bool,
    cedarPattern: pattern,
    rafterAmount: choice("off", "low", "medium", "high"),
    cedarOverrides: (v) =>
      object(v) &&
      Object.keys(v).length <= 12 &&
      Object.entries(v).every(
        ([k, value]) => /^section-[1-9][0-9]?$/.test(k) && override(value),
      ),
  },
);
const design = shape({
  version: choice(1),
  input: shape({
    widthMm: integer(1, Number.MAX_SAFE_INTEGER),
    projectionMm: integer(1, Number.MAX_SAFE_INTEGER),
    level: choice("ground", "elevated"),
    connection: choice("fascia", "facade", "soffit"),
  }),
  roof: shape(
    {
      family: choice("mono", "gable", "box"),
      orientation: choice("parallel", "away"),
      infills: bool,
    },
    {
      frameFinish: choice('black','white'),
      acrylicTint: choice(...CUSTOMER_ACRYLIC_TINT_OPTIONS.map(option => option.value)),
      attachmentIntent: choice("freestanding", "unsure"),
      finish,
      blinds: list(blind, 16),
      sidePanels: list(sidePanel, 16),
      roofBattens: battens,
      lighting,
    },
  ),
});

/** Structural intent only. Never normalizes, solves geometry, or accepts prices,
 * summaries or URLs. Marketing retains its stricter current applicability check. */
export function parseWebsiteSubmittedDesign(
  value: unknown,
):
  | { ok: true; value: WebsiteSubmittedDesignV1 }
  | { ok: false; message: string } {
  try {
    if (!design(value) || JSON.stringify(value).length > 12000)
      throw new Error();
    return {
      ok: true,
      value: structuredClone(value) as WebsiteSubmittedDesignV1,
    };
  } catch {
    return { ok: false, message: "Invalid submitted website design." };
  }
}
