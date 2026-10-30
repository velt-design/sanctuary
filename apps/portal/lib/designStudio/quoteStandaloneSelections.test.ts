import { expect, it } from 'vitest';
import type { SiteInputsV1 } from '@sp/costing';
import { studioStandaloneSelections } from './quoteStandaloneSelections';
import { quoteReviewDigest } from './quoteReviewDigest.server';

it('projects multiple resolved stock and infill rows with customer dimensions and finish only', () => {
  const site: SiteInputsV1 = {
    pergolas: [], additional_aluminium: { extrusion_colour: 'Black', rows: [
      { id: 'a', profile: '100x100', stock_length_m: 6, quantity: 1 },
      { id: 'b', profile: '200x50', stock_length_m: 6.5, quantity: 3 },
    ] },
    standalone_infills: {
      extrusion_colour: 'White', access: 'hard', height: 'two_storey',
      infills: [
        { id: 'r', label: 'Door', qty: 2, location: 'wall', acrylic_source: 'sheet_panels', panel_orientation: 'vertical',
          width_mode: 'target_width', support: { has_top: true, has_bottom: true, has_left: true, has_right: true },
          shape: { type: 'rect', width_m: 1.2, height_m: .6 } },
        { id: 's', label: 'Side', qty: 1, location: 'gable_end', acrylic_source: 'strip_620', panel_orientation: 'horizontal',
          width_mode: 'target_width', support: { has_top: true, has_bottom: true, has_left: true, has_right: true },
          shape: { type: 'mono_slope', width_m: 2, height_low_m: .3, height_high_m: .8, bottom_offset_m: .25 } },
      ],
    },
  };
  const before = structuredClone(site);
  Object.assign(site, { siteOutput: { internalCost: 'PRIVATE-COST-SENTINEL' }, supplierNotes: 'PRIVATE-NOTE-SENTINEL' });
  const selections = studioStandaloneSelections(site, []);
  expect(selections).toEqual([
    { label: 'Standalone aluminium · 100x100', details: ['Black aluminium', '1 full 6 m bar'] },
    { label: 'Standalone aluminium · 200x50', details: ['Black aluminium', '3 full 6.5 m bars'] },
    { label: 'Standalone infill · Door', details: ['2 openings · Wall', 'Rectangle · width 1200 mm × height 600 mm', 'White aluminium', 'Acrylic panels · vertical orientation'] },
    { label: 'Standalone infill · Side', details: ['1 opening · Gable end', 'Sloping opening · width 2000 mm · left height 300 mm · right height 800 mm', 'White aluminium', 'Acrylic strips · horizontal orientation', 'Bottom offset 250 mm'] },
  ]);
  expect(JSON.stringify(selections)).not.toMatch(/PRIVATE|internalCost|siteOutput|access|supplier/);
  expect(site.standalone_infills).toEqual(before.standalone_infills);
  const hash = quoteReviewDigest({ selections });
  selections[0].details[1] = '2 full 6 m bars';
  expect(quoteReviewDigest({ selections })).not.toBe(hash);
  expect(site.additional_aluminium).toEqual(before.additional_aluminium);
});

it.each([
  [false, 'Titania', '', 'Mill aluminium, powdercoat: Titania'],
  [true, 'Dormant standard', 'Ocean blue', 'Mill aluminium, custom powdercoat: Ocean blue'],
  [true, 'Dormant standard', '', 'Mill aluminium, custom powdercoat colour to be confirmed'],
] as const)('describes the active Mill finish without promoting dormant colours', (custom, standard, selected, expected) => {
  const site: SiteInputsV1 = { pergolas: [], additional_aluminium: {
    extrusion_colour: 'Mill', powdercoat_is_custom: custom, powdercoat_standard_colour: standard, powdercoat_custom_colour: selected,
    rows: [{ id: 'a', profile: '100x100', stock_length_m: 6, quantity: 1 }],
  } };
  expect(studioStandaloneSelections(site, [])[0].details[0]).toBe(expected);
});

it('describes each standalone blind without exposing rates or inferring absent items', () => {
  expect(studioStandaloneSelections({ pergolas: [] }, [])).toEqual([]);
  expect(studioStandaloneSelections({ pergolas: [] }, [
    { id: 'a', label: 'West', system: 'ZIPTRAK', widthMm: 2500, coverLengthMm: 2100, fabric: 'MESH', motorised: false, rollCover: 'NONE' },
    { id: 'b', label: 'East', system: 'OMNI', widthMm: 3000, coverLengthMm: 2400, fabric: 'FINE_MESH', motorised: true, rollCover: 'PELMET' },
    { id: 'c', system: 'ZIPTRAK', widthMm: 1800, coverLengthMm: 2000, fabric: 'PVC', motorised: false, rollCover: 'FLASHING' },
  ])).toEqual([
    { label: 'Standalone blind · West', details: ['Ziptrak · 2500 × 2100 mm', 'Mesh · Manual · No roll cover'] },
    { label: 'Standalone blind · East', details: ['Omni · 3000 × 2400 mm', 'Fine mesh · Motorised · Pelmet'] },
    { label: 'Standalone blind', details: ['Ziptrak · 1800 × 2000 mm', 'PVC · Manual · Flashing'] },
  ]);
});
