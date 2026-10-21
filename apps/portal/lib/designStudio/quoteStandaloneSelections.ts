import type { BlindLineItemInput, SiteInputsV1 } from '@sp/costing';
import type { StudioQuoteView } from '@sp/quote-format';

type Finish = NonNullable<SiteInputsV1['additional_aluminium']>;
function finish(value: Pick<Finish, 'extrusion_colour' | 'powdercoat_is_custom' | 'powdercoat_standard_colour' | 'powdercoat_custom_colour'>) {
  if (value.extrusion_colour !== 'Mill') return `${value.extrusion_colour} aluminium`;
  const colour = (value.powdercoat_is_custom ? value.powdercoat_custom_colour : value.powdercoat_standard_colour)?.trim();
  return `Mill aluminium, ${value.powdercoat_is_custom ? 'custom ' : ''}powdercoat${colour ? `: ${colour}` : ' colour to be confirmed'}`;
}
const mm = (metres: number) => `${Number((metres * 1000).toFixed(3))} mm`;
const locations = { front: 'Front', house: 'House side', side: 'Side', gable_end: 'Gable end', wall: 'Wall', custom: 'Custom opening' };
const fabrics = { MESH: 'Mesh', PVC: 'PVC', FINE_MESH: 'Fine mesh', NONE: 'No fabric' };
const covers = { NONE: 'No roll cover', FLASHING: 'Flashing', PELMET: 'Pelmet' };

/** Called only after costing/takeoff and blind validation succeed. Explicit
 * customer fields only: never serialize site outputs, rates or private evidence. */
export function studioStandaloneSelections(site: SiteInputsV1, blinds: BlindLineItemInput[]): StudioQuoteView['selections'] {
  const selections: StudioQuoteView['selections'] = [];
  const aluminium = site.additional_aluminium;
  for (const row of aluminium?.rows ?? []) selections.push({
    label: `Standalone aluminium · ${row.profile}`,
    details: [`${finish(aluminium!)}`, `${row.quantity} full ${row.stock_length_m} m ${row.quantity === 1 ? 'bar' : 'bars'}`],
  });
  const infills = site.standalone_infills;
  for (const row of infills?.infills ?? []) {
    const shape = row.shape;
    const dimensions = shape.type === 'rect'
      ? `Rectangle · width ${mm(shape.width_m)} × height ${mm(shape.height_m)}`
      : `Sloping opening · width ${mm(shape.width_m)} · left height ${mm(shape.height_low_m)} · right height ${mm(shape.height_high_m)}`;
    selections.push({
      label: `Standalone infill${row.label?.trim() ? ` · ${row.label.trim()}` : ''}`,
      details: [
        `${row.qty ?? 1} ${row.qty === 1 || row.qty === undefined ? 'opening' : 'openings'} · ${locations[row.location]}`,
        dimensions, finish(infills!),
        `Acrylic ${row.acrylic_source === 'strip_620' ? 'strips' : 'panels'}${row.panel_orientation ? ` · ${row.panel_orientation} orientation` : ''}`,
        ...(shape.bottom_offset_m ? [`Bottom offset ${mm(shape.bottom_offset_m)}`] : []),
      ],
    });
  }
  for (const row of blinds) selections.push({
    label: `Standalone blind${row.label?.trim() ? ` · ${row.label.trim()}` : ''}`,
    details: [`${row.system === 'ZIPTRAK' ? 'Ziptrak' : 'Omni'} · ${row.widthMm} × ${row.coverLengthMm} mm`,
      `${fabrics[row.fabric]} · ${row.motorised ? 'Motorised' : 'Manual'} · ${covers[row.rollCover ?? 'NONE']}`],
  });
  return selections;
}
