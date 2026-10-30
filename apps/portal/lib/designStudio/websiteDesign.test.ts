import { afterEach, expect, it, vi } from "vitest";
import * as geometry from "@sp/configurator/geometry";
import { defaultSidePanel, DEFAULT_ROOF_BATTENS } from "@sp/configurator/website";
import { newStudioWebsiteDesign, parseStudioWebsiteDesign, resolveStudioWebsiteDesign } from "./websiteDesign";

afterEach(() => vi.restoreAllMocks());
function design() {
  const value = newStudioWebsiteDesign("gap-owner");
  value.selection.roof.sidePanels = [{ ...defaultSidePanel("left-1of1", "timber"), species: "cedar" }];
  return value;
}
function parsedSelection(value: ReturnType<typeof design>) {
  const parsed = parseStudioWebsiteDesign(value, value.objectId);
  if (!parsed.ok) throw Error(parsed.message);
  return parsed.value.selection;
}
it('completes a valid raw gap on the actual independently supported rear opening', () => {
  const value = design();
  value.selection.roof.attachmentIntent = 'freestanding';
  value.selection.roof.sidePanels = [defaultSidePanel('rear-1of2', 'timber')];
  value.rawGaps = { 'rear-1of2': '27' };
  const original = structuredClone(value);
  const result = resolveStudioWebsiteDesign(value, value.objectId);
  expect(result).toMatchObject({ ok: true, value: { roof: { sidePanels: [{ opening: 'rear-1of2', gap: 27, customGap: true }] } } });
  expect(value).toEqual(original);
});
it.each(['', 'bad', '201'])('retains invalid active rear gap %s for repair', raw => {
  const value = design(); value.selection.roof.attachmentIntent = 'freestanding'; value.selection.roof.sidePanels = [defaultSidePanel('rear-1of2', 'timber')]; value.rawGaps = { 'rear-1of2': raw };
  const before=structuredClone(value);expect(resolveStudioWebsiteDesign(value,value.objectId)).toMatchObject({ok:false,field:'gap',gapKey:'rear-1of2'});expect(value).toEqual(before);
});
it.each(["absent", "dormant-roof", "acrylic"])("does not solve panel openings for %s raw panel gaps", kind => {
  const value = design();
  if (kind === "dormant-roof") value.rawGaps = { roof: "bad" };
  if (kind === "acrylic") { value.selection.roof.sidePanels = [defaultSidePanel("left-1of1", "acrylic")]; value.rawGaps = { "left-1of1": "bad" }; }
  const original = structuredClone(value), openings = vi.spyOn(geometry, "previewBlindOpenings");
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toEqual({ ok: true, value: parsedSelection(value) });
  expect(value).toEqual(original); expect(openings).not.toHaveBeenCalled();
});
it("keeps malformed/orphan keys and earlier roof-gap failures ahead of geometry", () => {
  const value = design(), openings = vi.spyOn(geometry, "previewBlindOpenings");
  value.rawGaps = { orphan: "27" };
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toEqual({ ok: false, message: "The website design choices could not be verified." });
  value.rawGaps = { roof: "bad", "left-1of1": "27" }; value.selection.roof.roofBattens = { ...DEFAULT_ROOF_BATTENS };
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toMatchObject({ ok: false, field: "gap", gapKey: "roof" });
  expect(openings).not.toHaveBeenCalled();
});
it.each(["valid", "invalid", "empty", "missing-opening", "acrylic-battens"])("retains active %s gap semantics and raw input", kind => {
  const value = design();
  if (kind === "missing-opening") value.selection.roof.sidePanels![0].opening = "front-9of9";
  if (kind === "acrylic-battens") value.selection.roof.sidePanels = [{ ...defaultSidePanel("left-1of1", "acrylic"), battens: true }];
  const key = value.selection.roof.sidePanels![0].opening;
  value.rawGaps = { [key]: kind === "invalid" ? "27.5" : kind === "empty" ? "" : "27" };
  const original = structuredClone(value), expected = parsedSelection(value), openings = vi.spyOn(geometry, "previewBlindOpenings");
  const actual = resolveStudioWebsiteDesign(value, value.objectId);
  if (kind === "invalid" || kind === "empty") expect(actual).toEqual({ ok: false, field: "gap", gapKey: key, message: "Enter a whole gap from 5–200 mm. Your input is kept." });
  else { if (kind !== "missing-opening") Object.assign(expected.roof.sidePanels![0], { gap: 27, customGap: true }); expect(actual).toEqual({ ok: true, value: expected }); }
  expect(value).toEqual(original); expect(openings).toHaveBeenCalledTimes(1);
});
it("uses one original pre-panel-mutation opening snapshot and preserves first active error order", () => {
  const value = design(); value.selection.roof.sidePanels!.push(defaultSidePanel("right-1of1", "aluminium"));
  value.rawGaps = { "left-1of1": "27", "right-1of1": "28" };
  const expected = parsedSelection(value), roofBefore = structuredClone(expected.roof), original = structuredClone(value), seen: unknown[] = [];
  const actualOpenings = geometry.previewBlindOpenings;
  const openings = vi.spyOn(geometry, "previewBlindOpenings").mockImplementation((input, roof, options) => { seen.push(structuredClone(roof)); return actualOpenings(input, roof, options); });
  expected.roof.sidePanels![0].gap = 27; expected.roof.sidePanels![1].gap = 28;
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toEqual({ ok: true, value: expected });
  expect(openings).toHaveBeenCalledTimes(1); expect(seen).toEqual([roofBefore]); expect(value).toEqual(original);
  value.rawGaps = { "left-1of1": "bad", "right-1of1": "also bad" };
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toMatchObject({ ok: false, gapKey: "left-1of1" });
});

it("keeps active opening-read failures with their existing owner, without treating an unused solve as a geometry certificate", () => {
  const value = design(), openings = vi.spyOn(geometry, "previewBlindOpenings").mockImplementation(() => { throw Error("opening read failed"); });
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toEqual({ ok: true, value: parsedSelection(value) });
  expect(openings).not.toHaveBeenCalled();
  value.rawGaps = { "left-1of1": "27" };
  expect(() => resolveStudioWebsiteDesign(value, value.objectId)).toThrow("opening read failed");
});
it("keeps the original solid-roof opening snapshot before removing dormant roof battens", () => {
  const value = design(); value.selection.roof.finish = { material: "solid", layout: "central", acrylicBays: 2, profile: "corrugated", trayWidth: 400, ceiling: "cedar-100" };
  value.selection.roof.roofBattens = { ...DEFAULT_ROOF_BATTENS }; value.rawGaps = { roof: "bad", "left-1of1": "27" };
  const expected = parsedSelection(value), before = structuredClone(expected.roof), original = structuredClone(value);
  const actualOpenings = geometry.previewBlindOpenings, snapshots: unknown[] = [];
  vi.spyOn(geometry, "previewBlindOpenings").mockImplementation((input, roof, options) => { snapshots.push(structuredClone(roof)); return actualOpenings(input, roof, options); });
  delete expected.roof.roofBattens; expected.roof.sidePanels![0].gap = 27;
  expect(resolveStudioWebsiteDesign(value, value.objectId)).toEqual({ ok: true, value: expected });
  expect(snapshots).toEqual([before]); expect(value).toEqual(original);
});
