import AttachmentSection from '@sp/configurator/react/attachment';
import {ATTACHMENT_DESCRIPTIONS,attachmentUnavailable,PREVIEW_SOFFIT_MAX_PROJECTION_MM,type SimpleCoverInput,type PreviewRoofChoices} from '@sp/configurator/geometry';
import css from './StudioWebsite.module.css';

export default function StudioAttachmentChoices({input,roof,method,onChange}:{input:SimpleCoverInput;roof:PreviewRoofChoices;method:SimpleCoverInput['connection'];onChange:(method:SimpleCoverInput['connection'])=>void}) {
 const unavailable=attachmentUnavailable(input,roof,method);
 return <div className={css.attachmentChoice}>
  <div className={css.houseRoofChoices}>{(['facade','fascia','soffit'] as const).map(value=>{
   const reason=attachmentUnavailable(input,roof,value);
   return <button key={value} aria-pressed={method===value} disabled={!!reason} title={reason??undefined} onClick={()=>onChange(value)}>{value==='facade'?'Wall':value==='fascia'?'Fascia':'Soffit brackets'}</button>;
  })}</div>
  <div className={css.attachmentIllustration}><AttachmentSection connection={method} boxPerimeter={roof.family==='box'}/></div>
  <p>{ATTACHMENT_DESCRIPTIONS[method]}</p>
  {unavailable&&<p className={css.fieldError}>{unavailable}</p>}
  {!unavailable&&input.projectionMm>PREVIEW_SOFFIT_MAX_PROJECTION_MM&&<p>Soffit brackets are available up to 4.0 m projection.</p>}
 </div>;
}
