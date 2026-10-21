import { useMemo } from 'react';
import {pergolaLightSites} from '@sp/geometry';
import { roofFinishDescription, solvePergolaPreview, previewBlindOpenings } from '@sp/configurator/geometry';
import { describeBlinds, describeSidePanels, describeRoofBattens, describeLighting, effectiveLightingLayout } from '@sp/configurator/website';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import { websiteComposition } from '@/lib/designStudio/websiteComposition';
import { studioHouseScene } from '@/lib/designStudio/studioHouseScene';
import { studioConnectionPresentation } from '@/lib/designStudio/studioConnectionPresentation';
import css from './StudioReview.module.css';

export default function StudioDesignSpecification({ edit }: { edit: StudioAuthoringEdit }) {
  const rows = useMemo(() => websiteComposition(edit), [edit]);
  const houses = useMemo(() => studioHouseScene(edit.site, edit.spatial)?.houses ?? [], [edit]);
  return <section className={css.specification} aria-label="Selected design specification"><h2>Selected design</h2>
    {rows.map(row => {
      const design = row.design, roof = design?.roof;
      const geometry = design && roof?.lighting && !row.error ? solvePergolaPreview(design.input, roof, row.geometryOptions).geometry : null;
      const lighting = roof?.lighting && geometry ? effectiveLightingLayout(pergolaLightSites(geometry.assembly, geometry.covering), roof.lighting).selection : null;
      const openings = design && roof && !row.error ? previewBlindOpenings(design.input, roof, row.geometryOptions) : [];
      const panels = roof?.sidePanels?.filter(p => openings.some(o => o.id === p.opening)) ?? [];
      const blinds = roof?.blinds?.filter(b => openings.some(o => o.id === b.opening)) ?? [];
      const inactiveSides = (roof?.sidePanels?.length ?? 0) + (roof?.blinds?.length ?? 0) - panels.length - blinds.length;
      const connection = studioConnectionPresentation(row, houses.find(h => h.id === row.studioAttachment?.houseId)?.label);
      return <article key={row.object.id}><h3>{row.object.label}</h3>{design && roof ? <>
        <p className={css.dimensions}>{design.input.widthMm.toLocaleString('en-NZ')} × {design.input.projectionMm.toLocaleString('en-NZ')} mm</p>
        <dl><div><dt>Shape</dt><dd>{roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'}{roof.family === 'gable' ? ` · ridge ${roof.orientation === 'away' ? 'along projection' : 'across width'}` : ''}</dd></div>
          <div><dt>Roof</dt><dd>{roofFinishDescription(roof)}</dd></div><div><dt>Frame</dt><dd>{roof.frameFinish === 'white' ? 'White' : 'Black'} aluminium</dd></div>
          <div><dt>Connection</dt><dd>{connection.state}<br/>{connection.detail}{connection.height && <><br/>{connection.height}</>}</dd></div>
          <div><dt>Sides</dt><dd>{panels.length ? describeSidePanels(panels) : blinds.length ? 'Blinds on selected openings' : 'Open sides'}{roof.infills && roof.family === 'gable' ? ' · Gable infills' : ''}</dd></div>
          <div><dt>Accessories</dt><dd>{[blinds.length ? describeBlinds(blinds) : '', roof.roofBattens ? describeRoofBattens(roof.roofBattens) : '', lighting ? describeLighting(lighting) : ''].filter(Boolean).join(' · ') || 'None selected'}</dd></div>
        </dl>{inactiveSides > 0 && <small>{inactiveSides} retained side selection(s) do not have a current opening. Check Sides before quoting.</small>}</> : <p>Selections need checking in the editor.</p>}{row.error && <p role="alert">{row.error} The model is a retained reference, not a priced connection.</p>}</article>;
    })}
    {!rows.length && <p>No pergolas in this design.</p>}
    {houses.map(h => <article key={h.id}><h3>{h.label}</h3><p>{Number(h.widthMm).toLocaleString('en-NZ')} × {Number(h.depthMm).toLocaleString('en-NZ')} mm · {h.roof.form === 'mono' ? 'Single-slope' : h.roof.form === 'hipped' ? 'Hipped' : 'Flat'} roof</p><small>Existing house shown for context, excluded from the pergola price.</small></article>)}
  </section>;
}
