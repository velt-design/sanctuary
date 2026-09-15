import type {PreviewRoofChoices} from './GableChoices';
import {useRail, type RailSection} from './RailProvider';
import {getRoofFinish} from './roofFinish';
import css from './designJourney.module.css';
import {SectionIcon} from './DesignIllustrations';
import art from './illustrations.module.css';
export default function PersonaliseOverview({roof,lightingNotice}:{roof:PreviewRoofChoices;lightingNotice?:string}){
 const {choose,explored}=useRail(),finish=getRoofFinish(roof);
 const cards:{section:RailSection;title:string;description:string;summary:string}[]=[
 {section:'roof',title:'Roof & ceiling',description:'Choose your balance of light, shade and timber finishes.',summary:(finish.material==='acrylic'?'Acrylic roof':finish.material==='solid'?'Solid roof + timber ceiling':'Combination roof + timber ceiling')+(roof.roofBattens?' · Timber battens':'')},
 {section:'sides',title:'Sides & privacy',description:'Explore blinds, timber and aluminium screening.',summary:((roof.blinds?.length??0)+(roof.sidePanels?.length??0))+(((roof.blinds?.length??0)+(roof.sidePanels?.length??0))===1?' opening configured':' openings configured')},
 {section:'lighting',title:'Lighting',description:'See how your space could feel after sunset.',summary:((roof.lighting?.rafterCount??0)+(roof.lighting?.cedarCount??0))+' lights · '+(roof.lighting?.strips.length??0)+' LED strips'}];
 return <section className={css.overview}><p className={css.eyebrow}>02 / PERSONALISE</p><h2>Make it yours.</h2><p>Choose a section to make it yours.</p><div className={css.cards}>{cards.map(card=><button key={card.section} onClick={()=>choose(card.section)}><div className={art.cardHeading}><SectionIcon section={card.section}/><strong>{card.title}<span aria-hidden="true">↗</span></strong></div><span className={css.selection}>{card.summary}</span><span className={css.cardBenefit}>{card.description}</span><small>{card.section==='lighting' && lightingNotice ? 'Roof changed · check lighting' : explored.includes(card.section)?'Explored':'Explore options'}</small></button>)}</div><p className={css.note}>Extras are optional. You can keep refining your design with us.</p></section>;
}
export function PersonaliseSectionHeading(){const {section,choose}=useRail();if(!['roof','sides','lighting'].includes(section))return null;return <div className={css.sectionIntro}><button className={css.reviewLink} onClick={()=>choose('personalise')}>← Back to Personalise</button></div>;}
