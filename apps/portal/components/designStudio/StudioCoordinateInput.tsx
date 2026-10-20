import {useState} from 'react';
import {displayStudioCoordinate} from './studioPlanDrag';

/** Formatting never writes a rounded value back unless the user actually edits. */
export default function StudioCoordinateInput({value,onChange,label}:{value:string;onChange:(raw:string)=>void;label:string}) {
 const [focused,setFocused]=useState(false);
 return <input aria-label={label} value={focused?value:displayStudioCoordinate(value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={event=>onChange(event.target.value)}/>;
}
