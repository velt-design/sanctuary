import { expect, it } from 'vitest';
import { buildRepresentativeBox, pergolaLightSites } from '@sp/geometry';
import { DEFAULT_LIGHTING, effectiveLightingLayout } from './lightingSelection';
import { solvePergolaPreview } from '../../geometry/website/solvePreview';
import { INITIAL_INPUT } from '../../geometry/website/model';
import { perimeterLedPreset } from './perimeterLedPreset';

it.each([3000, 4500])('places Box side perimeter LEDs on the original next inside rafter for %imm depth', projectionMm => {
  const { assembly } = buildRepresentativeBox({ widthMm: 6000, projectionMm, connection: 'facade', freestanding: true });
  const sites = pergolaLightSites(assembly).strips;
  const selected = perimeterLedPreset(sites);
  const slopes = assembly.roofPlanes.length;
  const count = new Set(assembly.members.filter(m => m.role === 'rafter').map(m => m.centerline.start.x)).size;
  for (let slope = 0; slope < slopes; slope++) {
    expect(selected).toContain(`box-rafter-${slope}-1`);
    expect(selected).toContain(`box-rafter-${slope}-${count - 2}`);
    expect(selected).not.toContain(`box-rafter-${slope}-0`);
  }
  expect(selected).not.toContain('box-left');
  expect(selected).not.toContain('box-right');
  // Explicit saved IDs remain actual available mounting sites.
  expect(sites.map(s => s.id)).toEqual(expect.arrayContaining(['box-left', 'box-right', 'box-rafter-0-0']));
});

it('keeps old explicit Box beam/edge IDs and does not substitute a concealed next rafter', () => {
  const geometry = solvePergolaPreview(INITIAL_INPUT, { family:'box', orientation:'parallel', infills:false, attachmentIntent:'freestanding' }).geometry!;
  const sites = pergolaLightSites(geometry.assembly, geometry.covering);
  const lighting = { ...DEFAULT_LIGHTING, strips: ['box-left', 'box-rafter-0-0'] };
  expect(effectiveLightingLayout(sites, lighting).selection.strips).toEqual(lighting.strips);
  expect(lighting.strips).toEqual(['box-left', 'box-rafter-0-0']);
  const left = sites.strips.find(s => s.id === 'box-rafter-0-1')!;
  const covering = { regions: [{ material:'solid', boundary:[{x:left.start.x-10,y:0,z:0},{x:left.start.x+10,y:0,z:0},{x:left.start.x+10,y:3000,z:0},{x:left.start.x-10,y:3000,z:0}] }] } as any;
  const hidden = pergolaLightSites(geometry.assembly, covering).strips;
  const preset = perimeterLedPreset(hidden);
  expect(preset).not.toContain('box-rafter-0-1');
  expect(preset).not.toContain('box-left');
  expect(preset).not.toContain('box-rafter-0-0');
  expect(preset).not.toContain('box-rafter-0-2');
});
