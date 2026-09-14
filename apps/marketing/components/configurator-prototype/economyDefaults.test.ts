import { expect, it } from 'vitest';
import { defaultBlind, parseBlinds } from './blindCatalog';
import { defaultSidePanel, parseSidePanels } from './sidePanelCatalog';
import { DEFAULT_ROOF_BATTENS, parseRoofBattens } from './roofBattenSelection';
import { INITIAL_ROOF } from './GableChoices';
import { INITIAL_INPUT } from './model';
import { parsePreviewDraft } from './previewDraft';
import { parsePreviewDesign, serializePreviewDesign } from './previewShare';
import { solvePergolaPreview } from './solvePreview';

it('starts optional upgrades off and uses value battens when enabled', () => {
  expect(defaultBlind('front-1of2')).toMatchObject({ cover: 'NONE', infill: false });
  expect(INITIAL_ROOF.infills).toBe(false);
  expect(INITIAL_ROOF.roofBattens).toBeUndefined();
  expect(DEFAULT_ROOF_BATTENS).toMatchObject({ species: 'thermopine', profile: '90x39', gap: 90 });
  expect(defaultSidePanel('front-1of2', 'acrylic')).toMatchObject({ frame: 50, battens: false });
});

it('preserves historic cedar, custom gaps and selected blind upgrades', () => {
  const old = { profile: '65x39', edge: true, gap: 125, customGap: true };
  expect(parseRoofBattens(old)).toEqual(old);
  const blind = { ...defaultBlind('front-1of2'), cover: 'PELMET' as const, infill: true };
  expect(parseBlinds([blind])).toEqual([blind]);
  const panel = { ...defaultSidePanel('front-1of2', 'timber'), species: 'cedar' as const };
  expect(parseSidePanels([panel])![0].species).toBe('cedar');
  expect(parseRoofBattens({ ...old, species: 'invented' })).toBeNull();
});

it('carries ThermoPine through share links and roof rendering', () => {
  const draft = parsePreviewDraft({ version: 1, input: INITIAL_INPUT, roof: { ...INITIAL_ROOF, roofBattens: DEFAULT_ROOF_BATTENS,
    sidePanels: [defaultSidePanel('front-1of2', 'timber')] } })!;
  expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
  const meshes = solvePergolaPreview(draft.input, draft.roof).geometry!.covering!.meshes;
  expect(meshes.filter(m => m.id.startsWith('roof-battens')).every(m => m.timberSpecies === 'thermopine')).toBe(true);
});
