import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { roofFinishDescription, getRoofFinish } from './roofFinish';
import { describeSidePanels } from './sidePanelCatalog';
import { useRail, type RailSection } from './RailProvider';
import css from './designJourney.module.css';

export default function DesignReview({ input, roof, lightingNotice }: { input: SimpleCoverInput; roof: PreviewRoofChoices; lightingNotice?: string }) {
  const { choose } = useRail();
  const finish=getRoofFinish(roof);
  const openingName=(id:string)=>id.replace(/^(front|left|right)-(\d+)of\d+$/,(_,side:string,index:string)=>side[0].toUpperCase()+side.slice(1)+' '+index);
  const sideSummary=[...(roof.blinds??[]).map(blind=>'Ziptrak blind on '+openingName(blind.opening)),...(roof.sidePanels??[]).map(panel=>(panel.kind==='acrylic'?'Acrylic panels'+(panel.battens?' with timber battens':''):panel.kind==='aluminium'?'Aluminium screening':(panel.species==='cedar'?'Cedar':'ThermoPine')+' screening')+' on '+openingName(panel.opening))].join(' · ');
  const rows: { title: string; detail: string; settings?:string; section: RailSection }[] = [
    { title: 'Size & structure', detail: `${(input.widthMm / 1000).toFixed(1)} × ${(input.projectionMm / 1000).toFixed(1)} m · ${roof.family === 'mono' ? 'Pitched' : roof.family === 'gable' ? 'Gable' : 'Box perimeter'} · ${input.level === 'ground' ? 'Ground level' : 'Elevated'} · ${roof.attachmentIntent==='freestanding'?'Freestanding':roof.attachmentIntent==='unsure'?'Connection to be confirmed':input.connection==='facade'?'Wall connection':input.connection==='fascia'?'Fascia connection':'Brackets under the eaves'}`, section: 'structure' },
    { title: 'Roof & ceiling', detail: (finish.material==='acrylic'?'Acrylic roof':finish.material==='solid'?'Solid roof':'Combination roof with skylight')+(finish.material!=='acrylic'?' · '+(finish.ceiling?.startsWith('cedar')?'Cedar':'ThermoPine')+' ceiling':'')+(roof.roofBattens?' · Timber battens':''), settings:roofFinishDescription(roof), section: 'roof' },
    { title: 'Sides & privacy', detail: sideSummary || 'Open sides, no extras selected', settings:describeSidePanels(roof.sidePanels), section: 'sides' },
    { title: 'Lighting', detail: `${(roof.lighting?.rafterCount ?? 0) + (roof.lighting?.cedarCount ?? 0)} lights · ${roof.lighting?.strips.length ?? 0} LED strips`, section: 'lighting' },
  ];
  return <section className={css.review} aria-label="Review your design">
    <h2>Your pergola, so far.</h2>
    <p>Check your selections, then send us your design to discuss a site measure. You can still change anything.</p>
    {rows.map(row => <div className={css.row} key={row.title}><div><strong>{row.title}</strong><p>{row.detail}</p>{row.settings&&<details className={css.reviewSettings}><summary>View settings</summary><p>{row.settings}</p></details>}{row.section === 'lighting' && lightingNotice && <p>{lightingNotice}</p>}</div><button onClick={() => choose(row.section)} aria-label={`Edit ${row.title}`}>Edit</button></div>)}
  </section>;
}

export function ReviewNextSteps(){return <section className={css.review} aria-label="What happens next">
    <h3>What happens next?</h3>
    <p>Your design goes with your enquiry. We’ll contact you to discuss your space and arrange a suitable site measure. This does not book a visit automatically.</p>
    <p>Free site measures in Auckland. We’ll discuss travel arrangements for other locations.</p>
  </section>;}
