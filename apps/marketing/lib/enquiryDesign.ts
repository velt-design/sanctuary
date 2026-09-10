import { parsePreviewDraft, type PreviewDraft } from '../components/configurator-prototype/previewDraft';
import { serializePreviewDesign } from '../components/configurator-prototype/previewShare';
import { roofFinishDescription } from '../components/configurator-prototype/roofFinish';
import { describeBlinds } from '../components/configurator-prototype/blindCatalog';
import { describeSidePanels } from '../components/configurator-prototype/sidePanelCatalog';
import { describeLighting, hasLighting } from '../components/configurator-prototype/lightingSelection';
import { describeRoofBattens } from '../components/configurator-prototype/roofBattenSelection';

export type EnquiryAudience = 'residential' | 'commercial' | 'professional';
export type CustomerBrief = {
  version: 1;
  audience: EnquiryAudience;
  designStatus: 'configured' | 'bespoke';
  design?: PreviewDraft;
  summary?: string;
  reopenPath?: string;
};

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
  });
}

/** Reject changed selections rather than silently saving a different pergola. Never accepts prices or URLs. */
export function buildCustomerBrief(audience: EnquiryAudience, value?: unknown): CustomerBrief {
  if (value === undefined || value === null) return { version: 1, audience, designStatus: 'bespoke' };
  if (JSON.stringify(value).length > 12000) throw new Error('Design is too large');
  const parsed = parsePreviewDraft(value);
  const design: PreviewDraft | null = parsed ? JSON.parse(JSON.stringify(parsed)) : null;
  if (!design || stable(design) !== stable(value)) throw new Error('Design needs to be refreshed');
  const { input, roof } = design;
  const summary = [
    roof.family === 'mono' ? 'Pitched pergola' : roof.family === 'gable' ? 'Gable pergola' : 'Box perimeter pergola',
    `${input.widthMm / 1000} m wide × ${input.projectionMm / 1000} m projection`,
    roofFinishDescription(roof),
    roof.family === 'gable' && roof.orientation === 'away' ? 'Dutch-gable fascia attachment' : input.connection === 'soffit' ? 'Soffit brackets' : `${input.connection === 'facade' ? 'Facade' : 'Fascia'} attachment`, input.level === 'ground' ? 'Ground level' : 'First-floor deck',
    ...(roof.family === 'gable' ? [`Ridge ${roof.orientation === 'away' ? 'away from' : 'parallel to'} house`, roof.infills ? 'Gable infills' : 'Open gable ends'] : []),
    ...(roof.blinds?.length ? [describeBlinds(roof.blinds)] : []),
    ...(roof.sidePanels?.length ? [describeSidePanels(roof.sidePanels)] : []),
    ...(roof.roofBattens ? [describeRoofBattens(roof.roofBattens)] : []),
    ...(hasLighting(roof.lighting) ? [describeLighting(roof.lighting!)] : []),
  ].join(' · ');
  const code = serializePreviewDesign(design);
  if (!code || code.length > 12000) throw new Error('Design cannot be shared');
  return { version: 1, audience, designStatus: 'configured', design, summary, reopenPath: `/configurator-preview?open=1#design=${code}` };
}

