import { describe, it, expect } from 'vitest';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';
import { previewBlindOpenings } from './blindSelection';
import { defaultBlind } from './blindCatalog';
import { defaultSidePanel } from './sidePanelCatalog';
import { applySideTreatment } from './sideTreatment';

const openings = previewBlindOpenings(INITIAL_INPUT, INITIAL_ROOF);
const [a, b, c] = openings;
describe('grouped side treatment', () => {
  it('replaces mixed selected types atomically and preserves unselected custom settings', () => {
    const existing = { ...defaultSidePanel(c.id, 'timber'), direction: 'horizontal' as const, gap: 70 };
    const roof = { ...INITIAL_ROOF, blinds: [defaultBlind(a.id)], sidePanels: [defaultSidePanel(b.id, 'acrylic'), existing] };
    const result = applySideTreatment(roof, openings, [a.id, b.id, a.id], 'aluminium');
    expect(result.issues).toEqual([]);
    expect(result.roof.blinds).toEqual([]);
    expect(result.roof.sidePanels).toHaveLength(3);
    expect(result.roof.sidePanels?.find(p => p.opening === c.id)).toBe(existing);
    expect(roof.blinds).toHaveLength(1);
  });
  it('retains same-kind custom finishes and can reopen only the selected group', () => {
    const custom = { ...defaultBlind(a.id), lowered: 50, cover: 'PELMET' as const };
    const roof = { ...INITIAL_ROOF, blinds: [custom, defaultBlind(b.id)] };
    expect(applySideTreatment(roof, openings, [a.id], 'blind').roof.blinds?.find(v => v.opening === a.id)).toBe(custom);
    expect(applySideTreatment(roof, openings, [a.id], 'open').roof.blinds).toEqual([roof.blinds[1]]);
  });
  it('rejects the whole group if one blind cannot fit, naming its opening', () => {
    const invalid = openings.map(o => o.id === b.id ? { ...o, width: 10000 } : o);
    const result = applySideTreatment(INITIAL_ROOF, invalid, [a.id, b.id], 'blind');
    expect(result.roof).toBe(INITIAL_ROOF);
    expect(result.issues[0]).toContain(b.label);
  });
  it('rejects empty and stale groups without writing', () => {
    for (const ids of [[], ['missing-opening']]) {
      const result = applySideTreatment(INITIAL_ROOF, openings, ids, 'timber');
      expect(result.roof).toBe(INITIAL_ROOF); expect(result.issues).not.toHaveLength(0);
    }
  });
});
