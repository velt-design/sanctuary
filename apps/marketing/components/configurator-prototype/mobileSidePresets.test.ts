import { describe, expect, it } from 'vitest';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';
import { previewBlindOpenings } from './blindSelection';
import { mobileSidePresets, sideConfigurationKey } from './mobileSidePresets';

const openings = previewBlindOpenings(INITIAL_INPUT, INITIAL_ROOF);
describe('mobile side configurations', () => {
  it('builds complete front/sides combinations without changing the roof or lighting', () => {
    const looks = mobileSidePresets(INITIAL_ROOF, openings);
    expect(looks).toHaveLength(5);
    const mixed = looks.find(v => v.id === 'mixed')!.roof;
    expect(mixed.blinds?.map(v => v.opening)).toEqual(openings.filter(v => v.side === 'front').map(v => v.id));
    expect(mixed.sidePanels?.map(v => v.opening)).toEqual(openings.filter(v => v.side !== 'front').map(v => v.id));
    expect(mixed.sidePanels?.every(v => v.profile === '90x39' && v.edge && v.gap === 100)).toBe(true);
    const { blinds: _b, sidePanels: _p, ...rest } = mixed;
    const { blinds: _ob, sidePanels: _op, ...original } = INITIAL_ROOF;
    expect(rest).toEqual(original);
    expect(INITIAL_ROOF.sidePanels ?? []).toEqual([]);
  });
  it('omits blind configurations when any affected opening cannot fit', () => {
    const invalid = openings.map(v => ({ ...v, width: 10000 }));
    expect(mobileSidePresets(INITIAL_ROOF, invalid).map(v => v.id)).toEqual(['open', 'timber']);
    expect(mobileSidePresets(INITIAL_ROOF, []).map(v => v.id)).toEqual(['open']);
  });
  it('recognises reordered saved settings but treats individual refinements as custom', () => {
    const timber = mobileSidePresets(INITIAL_ROOF, openings).find(v => v.id === 'timber')!.roof;
    expect(sideConfigurationKey({ ...timber, sidePanels: [...timber.sidePanels!].reverse() })).toBe(sideConfigurationKey(timber));
    expect(sideConfigurationKey({ ...timber, sidePanels: timber.sidePanels!.map(v => ({ ...v, gap: 75 })) })).not.toBe(sideConfigurationKey(timber));
  });
});
