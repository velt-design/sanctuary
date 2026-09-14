import { accessoryReviewPricer, ACCESSORY_REVIEW_RATES as DEFAULT_RATES, reviewSlatCost as calculateSlatCost, reviewAccessoryAssemblyCost as calculateAssemblyCost, priceBlindLineItem, priceRafterLighting,
  type AccessoryReviewLine, type InfillInputV1, type SiteInputsV1, type CostingConfigV1 } from '@sp/costing';
import { representativeBlindOpenings, pergolaLightSites, layoutRafterLights } from '@sp/geometry';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { solvePergolaPreview } from '../components/configurator-prototype/solvePreview';
import { sidePanelSupports } from '../components/configurator-prototype/sidePanelLayout';
import { faceWidth } from '../components/configurator-prototype/sidePanelCatalog';
import { availableRafterSpots } from '../components/configurator-prototype/lightingSelection';
import { selectedCedarLights } from '../components/configurator-prototype/cedarSelection';

const infill = (id: string, width: number, low: number, high: number): InfillInputV1 => ({
  id, location: 'side', acrylic_source: 'sheet_panels', panel_orientation: 'vertical', width_mode: 'target_width',
  support: { has_top: true, has_bottom: true, has_left: true, has_right: true, internal_support_mode: 'none' },
  shape: Math.abs(high-low)<1 ? { type: 'rect', width_m: width/1000, height_m: high/1000 }
    : { type: 'mono_slope', width_m: width/1000, height_low_m: Math.max(1,low)/1000, height_high_m: high/1000 },
});

/** Selection-to-quantity adapter for the unpublished owner review only. */
export function configuratorAccessoryReview(draft: PreviewDraft, site: SiteInputsV1, config: CostingConfigV1) {
  const { roof } = draft, lines: AccessoryReviewLine[] = [], excluded: string[] = [], infills: InfillInputV1[] = [];
  const R = config.accessoryRates ?? DEFAULT_RATES;
  const reviewSlatCost = (input: Parameters<typeof calculateSlatCost>[0]) => calculateSlatCost(input, R);
  const reviewAccessoryAssemblyCost = (input: Parameters<typeof calculateAssemblyCost>[0]) => calculateAssemblyCost(input, R);
  const g = solvePergolaPreview(draft.input, roof).geometry;
  if (!g) throw new Error('Accessory geometry unavailable');
  const openings = representativeBlindOpenings(g.assembly), pricer = accessoryReviewPricer(site, config);
  if(g.assembly.members.some(m=>m.metadata?.blindPelmetClearance)) excluded.push('Automatic 150 × 150 pelmet-clearance post upgrade: incremental cost needs mapping');
  for (const blind of roof.blinds ?? []) {
    const o = openings.find(o => o.id === blind.opening);
    if (!o) { excluded.push(`Blind ${blind.opening}: opening unavailable`); continue; }
    // Specialty ranges have no confirmed mapping to the portal's three fabric groups.
    if (!['classic','urban','extreme','one','pvc'].includes(blind.fabric)) { excluded.push(`${o.label} blind: specialty fabric rate needed`); continue; }
    const price = priceBlindLineItem({ id: blind.opening, system: 'ZIPTRAK', widthMm: o.width, coverLengthMm: o.top,
      fabric: blind.fabric === 'pvc' ? 'PVC' : blind.fabric === 'classic' || blind.fabric === 'urban' ? 'MESH' : 'FINE_MESH',
      motorised: false, rollCover: blind.cover }, config.installedSellingRates?.blinds);
    if (price.errors.length) { excluded.push(`${o.label} blind: ${price.errors.join(' ')}`); continue; }
    lines.push({label: `${o.label} · Ziptrak`, amount: Math.round(price.blindSellIncCents/100), provisional: true,
      detail: 'Portal manual-blind price including installation and selected roll cover. Fabric-group mapping and pelmet kit scope remain provisional; no motor included.'});
    if (o.headerDepth) {
      const strut = Math.max(...o.roofLine.map(p=>p.z))-o.top;
      lines.push(pricer.allowance(`${o.label} · blind header & strut`, reviewAccessoryAssemblyCost({frameM:(o.width+strut)/1000}),
        'Provisional level header and house-side strut, supplied, finished and fitted.'));
      if (blind.infill) infills.push(infill(`blind-${o.id}`,o.width,Math.min(...o.roofLine.map(p=>p.z))-o.top, strut));
    }
  }
  for (const p of roof.sidePanels ?? []) {
    const o = openings.find(o=>o.id===p.opening);
    if (!o) { excluded.push(`Side panel ${p.opening}: opening unavailable`); continue; }
    const heights = o.headerDepth ? o.roofLine.map(v=>v.z) : [o.top,o.top,o.top];
    const height = Math.max(...heights), supports = sidePanelSupports(o,p);
    if (p.kind === 'acrylic') {
      infills.push(infill(`side-${o.id}`,o.width,Math.min(...heights),height));
      const frameM = (2*o.width + (supports.length)*height)/1000;
      lines.push(pricer.allowance(`${o.label} · panel perimeter`, reviewAccessoryAssemblyCost({frameM:2*(o.width+height)/1000,
        upgradedFrameM:p.frame===100?frameM:0}), 'Provisional perimeter framing; 100 × 50 upgrade where selected. Portal takeoff prices internal supports separately.'));
    }
    if (p.kind !== 'acrylic' || p.battens) {
      const vertical = p.kind!=='acrylic' && p.direction==='vertical';
      const face = faceWidth(p.profile,p.edge), span = vertical ? o.width : height;
      // Gross cut lengths before slope trimming; waste is added in the shared allowance.
      const count = Math.max(1,Math.floor((span+p.gap)/(face+p.gap)));
      const lengthM = count*(vertical ? height : o.width)/1000;
      const perimeterM = p.kind==='acrylic' ? 0 : 2*(o.width+height)/1000;
      const internalM = p.kind==='acrylic' ? 0 : Math.max(0,supports.length-2)*(vertical?o.width:height)/1000;
      const plate = vertical && p.kind==='timber';
      lines.push(pricer.allowance(`${o.label} · ${p.kind==='aluminium'?'aluminium slats':'timber battens'}`,
        reviewSlatCost({material:p.kind==='aluminium'?'aluminium':'timber',profile:p.profile,species:p.species,lengthM,
          cutPieces:count*Math.ceil((vertical?height:o.width)/4800),fixingPoints:count*supports.length,
          frameM:perimeterM+(plate?0:internalM),plateM:plate?internalM:0}),
        `${p.kind==='aluminium'?'Aluminium':p.species==='thermopine'?'ThermoPine':'Cedar'} ${p.profile} · ${p.gap} mm gap · approx. ${lengthM.toFixed(1)} lm before slope trimming. Provisional supply, finish, waste, supports and fitting. Supplier rates and fitting allowances need confirmation.`));
    }
  }
  if (roof.infills && roof.family==='gable') {
    const groups = new Map<string, typeof g.assembly.roofCladdingPanels>();
    for(const panel of g.assembly.roofCladdingPanels.filter(p=>p.metadata?.representativeGableInfill)) {
      const key=panel.id.replace(/-infill-\d+$/,''); groups.set(key,[...(groups.get(key)??[]),panel]);
    }
    for(const [id,panels] of groups) {
      const points=panels.flatMap(p=>p.boundary), xs=points.map(p=>p.x),ys=points.map(p=>p.y),zs=points.map(p=>p.z);
      infills.push(infill(id,Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),1,Math.max(...zs)-Math.min(...zs)));
    }
    if(!groups.size) excluded.push('Gable infill dimensions unavailable');
  }
  if(infills.length) {
    try { const line=pricer.infills(infills); if(line)lines.push(line); }
    catch { excluded.push('Acrylic panels & infills: takeoff needs review'); }
  }
  if(roof.roofBattens) {
    const boundaries=g.covering?.battenBoundaries??[];
    const lengthM=boundaries.reduce((sum,b)=>sum+Math.max(...b.map((p,i)=>Math.hypot(p.x-b[(i+1)%b.length].x,p.y-b[(i+1)%b.length].y,p.z-b[(i+1)%b.length].z)))/1000,0);
    const runsM=boundaries.map(b=>Math.hypot(b[1].x-b[0].x,b[1].y-b[0].y,b[1].z-b[0].z)/1000);
    // Budget takeoff: joins at up to 4.8m and fixing points at the nominal 620mm rafter module.
    const cutPieces=runsM.reduce((n,m)=>n+Math.ceil(m/4.8),0);
    const fixingPoints=runsM.reduce((n,m)=>n+Math.ceil(m/.62)+1,0);
    if(lengthM>0) lines.push(pricer.allowance('Roof timber battens',reviewSlatCost({material:'timber',profile:roof.roofBattens.profile,species:roof.roofBattens.species,lengthM,frameM:0,cutPieces,fixingPoints}),
      `${roof.roofBattens.species==='thermopine'?'ThermoPine':'Cedar'} · approx. ${lengthM.toFixed(1)} lm. Provisional selected-length supply, coating and waste; ${cutPieces} cut pieces and ${fixingPoints} estimated fixing points. Supplier rates and fitting times need confirmation.`));
    else excluded.push('Roof battens: no measurable coverage');
  }
  if(roof.lighting) {
    const l=roof.lighting, sites=pergolaLightSites(g.assembly,g.covering), strips=sites.strips.filter(s=>l.strips.includes(s.id));
    const count=layoutRafterLights(availableRafterSpots(sites.rafters,strips.map(s=>s.id)),l.rafterAmount??'off').length;
    const cedar=selectedCedarLights(sites.cedar,l).length;
    if(count) {
      const p=priceRafterLighting({pergolaId:'preview',lightCount:count,dimmer:false,acrylicEligible:true},config.installedSellingRates?.rafterLighting);
      if(p.errors.length)excluded.push('Rafter lighting');
      else lines.push({label:`Rafter lighting · ${count} lights`,amount:Math.round(p.lightingSellIncCents/100),provisional:false,detail:'Portal price including installation, startup and required drivers. Only exposed eligible rafters are counted.'});
    }
    if(cedar) lines.push(pricer.allowance(`Ceiling downlights · ${cedar} lights`,reviewAccessoryAssemblyCost({cedarLights:cedar}),'Pricebook supply and fit allowance per 110 mm downlight, before selling multiplier.'));
    if(strips.length) {
      const length=strips.reduce((sum,s)=>sum+Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y,s.end.z-s.start.z)/1000,0);
      lines.push(pricer.allowance(`LED strips · ${length.toFixed(1)} m`,reviewAccessoryAssemblyCost({ledM:length,ledRuns:strips.length}),
        'Provisional $65/m ex-GST strip, 16 × 16 channel and fitting; $100 driver allowance per member, before selling multiplier.'));
    }
    if(!count&&(cedar||strips.length))lines.push(pricer.allowance('Lighting connection',R.electricalConnection,'One provisional electrical connection allowance. Existing suitable supply assumed; new circuits and difficult cable routes excluded.'));
  }
  return {lines,excluded};
}
