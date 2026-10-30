import { studioDocumentHeightFacts } from "./facts";
import type { StudioDocumentProduct } from "./contract";
const size = (value: number) => String(Math.round(value * 10) / 10);
const memberSizes = (members: StudioDocumentProduct["assembly"]["members"]) =>
  [
    ...new Set(
      members.map(
        (m) => `${size(m.profile.depthMm)} x ${size(m.profile.widthMm)} mm`,
      ),
    ),
  ].join("; ");
export function refinedHeightFacts(product: StudioDocumentProduct) {
  const facts = studioDocumentHeightFacts(product, {
    bearingScope: "main_horizontal_beams",
  });
  if (!facts.eaves.length) throw Error("Main bearing geometry is unavailable");
  return {
    low: facts.eaves[0],
    high: facts.eaves.at(-1)!,
    ridgeTop: facts.ridgeTop,
    pitch: facts.pitchDeg ?? 0,
  };
}
export function refinedSpecificationRows(
  product: StudioDocumentProduct,
): Array<[string, string]> {
  const [roofDescription, ...additionalRoofDetails] =
    product.roofMaterial.split("; ");
  const parts = roofDescription.split(" · "),
    roof = parts.shift() ?? product.roofMaterial,
    ceiling = parts.filter((value) => /ceiling|mm boards/.test(value)),
    skylight = parts.filter((value) => /skylight|equal/.test(value)),
    tint = parts.filter((value) => /acrylic/.test(value));
  const members = product.assembly.members,
    rows: Array<[string, string]> = [["ROOF", roof]];
  if (ceiling.length)
    rows.push(["CEILING", ceiling.join(", ").replace(" ceiling", "")]);
  if (skylight.length)
    rows.push([
      "SKYLIGHT",
      [...skylight, ...tint].join(", ").replace(" skylight", ""),
    ]);
  else if (tint.length) rows.push(["TINT", tint.join(", ")]);
  for (const detail of additionalRoofDetails) {
    rows.push([/battens/i.test(detail) ? "BATTENS" : "ROOF DETAIL", detail]);
  }
  rows.push(
    [
      "BEAMS",
      memberSizes(
        members.filter(
          (m) =>
            (m.role === "beam" || m.role === "ledger") &&
            !m.metadata?.frameRole,
        ),
      ),
    ],
    ["RAFTERS", memberSizes(members.filter((m) => m.role === "rafter"))],
    ["POSTS", memberSizes(members.filter((m) => m.role === "post"))],
  );
  const ties = members.filter((m) =>
    String(m.metadata?.frameRole ?? "").startsWith("tie_beam"),
  );
  if (ties.length) rows.push(["TIES", memberSizes(ties)]);
  const ridge = members.filter((m) => m.role === "ridge");
  if (ridge.length) rows.push(["RIDGE", memberSizes(ridge)]);
  const gutters = members.filter((m) => m.role === "gutter");
  if (gutters.length)
    rows.push([
      "GUTTER",
      [
        ...new Set(gutters.map((m) => `${size(m.profile.widthMm)} mm wide`)),
      ].join("; "),
    ]);
  return rows.filter(([, value]) => !!value);
}
/** Concise wording of the same selected facts. Zero/unselected lighting is
 * represented by the status grid, not a long list of zero-count controls. */
export function compactExtra(value: string) {
  return value
    .replace("Warm-white lighting:", "Warm white;")
    .replace(/,?\s*0 ceiling downlights \([^)]*\)/g, "")
    .replace(/,?\s*0 rafter spots \([^)]*\)/g, "")
    .replace(/,?\s*0 full-length LED channels/g, "")
    .replace("vertical timber slats,", "vertical slats,")
    .replace("horizontal timber slats,", "horizontal slats,")
    .replace(/ mm clear gap/g, " mm gap")
    .replace(/matching perimeter angle/g, "matching angle")
    .replace(/full-length LED channels/g, "LED channels")
    .replace(/\s+/g, " ")
    .trim();
}
export function refinedExtras(product: StudioDocumentProduct) {
  return (["infills", "blinds", "lights"] as const).map((key) => ({
    key,
    label: key.toUpperCase(),
    selected:
      key === "lights"
        ? product.accessories.some((m) => m.kind === "light")
        : product.extras[key].length > 0,
    value: compactExtra(product.extras[key].join("; ")),
  }));
}
