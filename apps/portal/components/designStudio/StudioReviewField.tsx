export default function StudioReviewField({label,value,onChange,options}:{label:string;value:unknown;onChange:(value:string)=>void;options?:readonly (readonly [string,string])[]}) {
 return <label>{label}{options
   ? <select value={String(value??'')} onChange={event=>onChange(event.target.value)}>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>
   : <input value={String(value??'')} onChange={event=>onChange(event.target.value)}/>}
 </label>;
}
