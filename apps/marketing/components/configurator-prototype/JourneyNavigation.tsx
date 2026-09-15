import { useRail } from './RailProvider';
import css from './designJourney.module.css';
export default function JourneyNavigation() {
 const {section,choose}=useRail();
 const inside=section==='roof'||section==='sides'||section==='lighting';
 return <div className={css.navigation}><div className={css.actions}>
 {section==='review'?<button className={css.back} onClick={()=>choose('personalise')}>Back to Personalise</button>:<button className={css.next} onClick={()=>choose(inside?'personalise':section==='structure'?'personalise':'review')}><span className={css.desktopAction}>{inside?'Back to Personalise':section==='structure'?'Personalise your pergola →':'Review my design →'}</span><span className={css.mobileAction}>{inside?'Done':section==='structure'?'Personalise →':'Review →'}</span></button>}
 </div></div>;
}
