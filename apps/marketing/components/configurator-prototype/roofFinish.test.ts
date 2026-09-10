import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOF_FINISH } from '@sp/geometry';
import { representativeRoofProfile } from '@sp/geometry';
import { INITIAL_INPUT } from './model';
import { solvePergolaPreview } from './solvePreview';
import { INITIAL_ROOF, type PreviewRoofChoices } from './GableChoices';
import { parsePreviewDraft } from './previewDraft';
import { parsePreviewDesign, serializePreviewDesign } from './previewShare';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';

describe('solid and combination roof preview', () => {
  it.each(['corrugated', 'trapezoidal', 'tray'] as const)('uses the supplied %s profile proportions', profile => {
    const shape = representativeRoofProfile(profile, 300);
    expect(shape.pitch).toBe(profile === 'corrugated' ? 76.2 : profile === 'trapezoidal' ? 154 : 300);
    expect(Math.max(...shape.points.map(p => p.height))).toBe(profile === 'corrugated' ? 17 : profile === 'trapezoidal' ? 21 : 39);
  });
  for (const family of ['mono', 'gable', 'box'] as const) for (const profile of ['corrugated', 'trapezoidal', 'tray'] as const) {
    it(`${family} ${profile} produces finite, bounded meshes and separate light/solid regions`, () => {
      const roof: PreviewRoofChoices = { ...INITIAL_ROOF, family, finish: { ...DEFAULT_ROOF_FINISH, material: 'combination', profile } };
      const result = solvePergolaPreview(INITIAL_INPUT, roof);
      expect(result.geometry, JSON.stringify(result.messages)).toBeDefined();
      const { covering, assembly } = result.geometry!;
      expect(covering!.regions.some(r => r.material === 'solid')).toBe(true);
      expect(covering!.regions.some(r => r.material === 'acrylic')).toBe(true);
      expect(covering!.meshes.some(m => m.kind === 'cedar' && m.indices.length)).toBe(true);
      expect(covering!.meshes.every(m => m.positions.every(Number.isFinite))).toBe(true);
      expect(covering!.meshes.reduce((sum, m) => sum + m.indices.length / 3, 0)).toBeLessThan(12000);
      expect(assembly.quantityHooks).toEqual([]);
      expect(assembly.members.some(member => member.id.startsWith('finish-purlin-'))).toBe(false);
      const glazing = covering!.regions.filter(r => r.material === 'acrylic');
      for (const region of glazing) {
        const xs = region.boundary.map(p => p.x);
        expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(INITIAL_INPUT.widthMm / 2, 0);
      }
    });
  }
  it('restricts house bands, clamps bay count and carries the resulting choices through links and enquiry', () => {
    const draft = parsePreviewDraft({ version: 1, input: { ...INITIAL_INPUT, widthMm: 2000 }, roof: {
      ...INITIAL_ROOF, finish: { ...DEFAULT_ROOF_FINISH, material: 'combination', layout: 'house', acrylicBays: 16, profile: 'tray', trayWidth: 500 },
    } })!;
    expect(draft.roof.finish!.layout).toBe('central');
    expect(draft.roof.finish!.acrylicBays).toBe(2);
    expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
    const brief = buildContactDesignBrief({ ...draft, result: null });
    expect(brief.estimate).toBeNull();
    expect(brief.roofMaterials).toEqual(['acrylic', 'timber']);
    expect(brief.description).toContain('Tray 500 mm');
    expect(brief.description).toContain('2 acrylic bays');
  });
  it('solid removes roof glazing but retains selected gable-end infills', () => {
    const result = solvePergolaPreview(INITIAL_INPUT, { ...INITIAL_ROOF, family: 'gable', infills: true,
      finish: { ...DEFAULT_ROOF_FINISH, material: 'solid' } });
    expect(result.geometry!.assembly.roofCladdingPanels.length).toBeGreaterThan(0);
    expect(result.geometry!.assembly.roofCladdingPanels.every(p => p.metadata?.representativeGableInfill)).toBe(true);
  });
  it('keeps the box cedar ceiling level and inside its perimeter; rejects insufficient build-up depth', () => {
    const roof: PreviewRoofChoices = { ...INITIAL_ROOF, family: 'box', finish: { ...DEFAULT_ROOF_FINISH, material: 'solid', profile: 'tray' } };
    const { geometry } = solvePergolaPreview(INITIAL_INPUT, roof);
    const cedar = geometry!.covering!.meshes.filter(m => m.kind === 'cedar');
    expect(geometry!.assembly.roofPlanes).toHaveLength(2);
    expect(geometry!.assembly.members.filter(m => m.role === 'gutter').map(m => m.centerline.start.y)).toEqual([100, INITIAL_INPUT.projectionMm - 100]);
    expect(cedar.every(mesh => mesh.positions.filter((_, i) => i % 3 === 2).every(z => z === 2400 || z === 2412))).toBe(true);
    expect(geometry!.covering!.meshes.flatMap(m => m.positions.filter((_, i) => i % 3 === 2)).every(z => z <= 2700)).toBe(true);
    const large = solvePergolaPreview({ ...INITIAL_INPUT, projectionMm: 6000 }, roof);
    expect(large.geometry).toBeUndefined();
    expect(large.messages[0].message).toContain('deeper perimeter');
  });
  it('keeps house-side glazing at the house while added bays grow outwards', () => {
    for (const acrylicBays of [1, 2, 3]) {
      const result = solvePergolaPreview({ ...INITIAL_INPUT, projectionMm: 5000 }, { ...INITIAL_ROOF, family: 'gable', orientation: 'away',
        finish: { ...DEFAULT_ROOF_FINISH, material: 'combination', layout: 'house', acrylicBays } });
      for (const region of result.geometry!.covering!.regions.filter(r => r.material === 'acrylic')) {
        const ys = region.boundary.map(p => p.y);
        expect(Math.min(...ys)).toBeCloseTo(25);
        expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(620 * acrylicBays);
      }
    }
  });
  it.each([null, { ...DEFAULT_ROOF_FINISH, profile: ['tray'] }, { ...DEFAULT_ROOF_FINISH, acrylicBays: Infinity },
    { ...DEFAULT_ROOF_FINISH, trayWidth: 350 }])('rejects malformed finish choices', finish => {
    expect(parsePreviewDraft({ version: 1, input: INITIAL_INPUT, roof: { ...INITIAL_ROOF, finish } })).toBeNull();
  });
});
