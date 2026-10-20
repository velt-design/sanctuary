import {isStudioObject,type StudioJsonObject} from '@/lib/designStudio/contracts';
import Field from './StudioReviewField';

export default function StudioStandaloneInfillFields({row,onChange}:{row:StudioJsonObject;onChange:(patch:StudioJsonObject)=>void}) {
 const shape=isStudioObject(row.shape)?row.shape:{};
 const support=isStudioObject(row.support)?row.support:{};
 const shapeChange=(key:string,value:string)=>onChange({shape:{...shape,[key]:value}});
 const slope=shape.type==='mono_slope';
 const mode=shape.slopeMode??'heights';
 return <>
  <Field label="Infill label" value={row.label} onChange={label=>onChange({label})}/>
  <Field label="Quantity" value={row.qty} onChange={qty=>onChange({qty})}/>
  <Field label="Location" value={row.location} options={[["custom","Custom"],["front","Front"],["house","House"],["side","Side"],["gable_end","Gable end"],["wall","Wall"]]} onChange={location=>onChange({location})}/>
  <Field label="Acrylic source" value={row.acrylicSource} options={[["auto","Automatic"],["sheet_panels","Sheet panels"],["strip_620","620 mm strip"]]} onChange={acrylicSource=>onChange({acrylicSource})}/>
  <Field label="Panel orientation" value={row.panelOrientation} options={[["auto","Automatic"],["vertical","Vertical"],["horizontal","Horizontal"]]} onChange={panelOrientation=>onChange({panelOrientation})}/>
  <Field label="Shape" value={shape.type??'rect'} options={[["rect","Rectangle"],["mono_slope","Sloping top"]]} onChange={type=>onChange({shape:type==='rect'?{type,widthM:String(shape.widthM??''),heightM:'',bottomOffsetM:String(shape.bottomOffsetM??'0')}:{type,widthM:String(shape.widthM??''),heightLowM:'',heightHighM:'',bottomOffsetM:String(shape.bottomOffsetM??'0'),slopeMode:'heights',slopeDeg:'',slopeAnchor:'left'}})}/>
  <Field label="Width (m)" value={shape.widthM} onChange={value=>shapeChange('widthM',value)}/>
  {!slope&&<Field label="Height (m)" value={shape.heightM} onChange={value=>shapeChange('heightM',value)}/>}
  {slope&&<>
   <Field label="Define sloping top" value={mode} options={[["heights","Left and right heights"],["pitch","One height and pitch"]]} onChange={value=>shapeChange('slopeMode',value)}/>
   {mode==='pitch'&&<><Field label="Known height side" value={shape.slopeAnchor} options={[["left","Left"],["right","Right"]]} onChange={value=>shapeChange('slopeAnchor',value)}/><Field label="Infill slope (degrees)" value={shape.slopeDeg} onChange={value=>shapeChange('slopeDeg',value)}/></>}
   {(mode==='heights'||shape.slopeAnchor!=='right')&&<Field label="Left height (m)" value={shape.heightLowM} onChange={value=>shapeChange('heightLowM',value)}/>}
   {(mode==='heights'||shape.slopeAnchor==='right')&&<Field label="Right height (m)" value={shape.heightHighM} onChange={value=>shapeChange('heightHighM',value)}/>}
  </>}
  <Field label="Bottom offset (m)" value={shape.bottomOffsetM??'0'} onChange={value=>shapeChange('bottomOffsetM',value)}/>
  {['top','bottom','left','right'].map(edge=><Field key={edge} label={`${edge} edge support`} value={isStudioObject(support.edgeConfirmations)?support.edgeConfirmations[edge]:'unsure'} options={[["unsure","To confirm"],["yes","Present"],["no","Required"]]} onChange={value=>onChange({support:{...support,edgeConfirmations:{...(isStudioObject(support.edgeConfirmations)?support.edgeConfirmations:{}),[edge]:value}}})}/>)}
  <Field label="Existing internal supports" value={support.internalSupportMode??'none'} options={[["none","None"],["center","One at centre"],["custom","Enter positions"]]} onChange={internalSupportMode=>onChange({support:{...support,internalSupportMode}})}/>
  {support.internalSupportMode==='custom'&&<Field label="Internal support positions (m, separated by commas)" value={Array.isArray(support.internalSupportPositionsM)?support.internalSupportPositionsM.join(', '):''} onChange={value=>onChange({support:{...support,internalSupportPositionsM:value.split(',').map(token=>token.trim()).filter(Boolean)}})}/>}
  <p>Confirm actual fixing members. A slab does not count as a bottom fixing member. Separate infills use explicit support positions.</p>
 </>;
}
