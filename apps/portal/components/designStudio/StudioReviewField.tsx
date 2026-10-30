export default function StudioReviewField({label,value,onChange,options,disabled}:{label:string;value:unknown;onChange:(value:string)=>void;options?:readonly (readonly [string,string])[];disabled?:boolean}) {
 return <label>{label}{options
   ? <select disabled={disabled} value={String(value??'')} onChange={event=>onChange(event.target.value)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>
   : <input disabled={disabled} value={String(value??'')} onChange={event=>onChange(event.target.value)}/>}
 </label>;
}
