'use client';
import { useEffect, useRef, useState } from 'react';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import PergolaFootprint from './PergolaFootprint';
import PreviewControls from './PreviewControls';
import MobileSiteChoices from './MobileSiteChoices';
import css from './mobileJourney.module.css';

/** Keep continuous pointer/keyboard input local; solve and persist once it settles. */
export default function MobileSizeStep({ input, roof, setInput, setRoof, activeDimension, showDimension }: {
  input: SimpleCoverInput; roof: PreviewRoofChoices;
  setInput: (input: SimpleCoverInput) => void; setRoof: (roof: PreviewRoofChoices) => void;
  activeDimension: PreviewDimensionAxis | null; showDimension: (axis: PreviewDimensionAxis | null) => void;
}) {
  const [live, setLive]=useState(input);
  const [resizing, setResizing]=useState(false);
  const pending=useRef<SimpleCoverInput | null>(null);
  const interacting=useRef(false);
  const commitRef=useRef(setInput);
  commitRef.current=setInput;
  function finish() {
    interacting.current=false;
    setResizing(false);
    if(pending.current){const value=pending.current;pending.current=null;commitRef.current(value);}
  }
  useEffect(()=>{if(!interacting.current)setLive(input);},[input]);
  useEffect(()=>{
    const commit=()=>finish();
    window.addEventListener('pointerup',commit);
    window.addEventListener('pointercancel',commit);
    window.addEventListener('blur',commit);
    return ()=>{
      window.removeEventListener('pointerup',commit);
      window.removeEventListener('pointercancel',commit);
      window.removeEventListener('blur',commit);
      commit();
    };
  },[]);
  const isRange=(target: EventTarget)=>target instanceof HTMLInputElement && target.type==='range';
  return <div data-mobile-size-draft data-committed-width={input.widthMm} data-committed-projection={input.projectionMm}
    onPointerDownCapture={e=>{if(isRange(e.target)){interacting.current=true;setResizing(true);}}}
    onKeyDownCapture={e=>{if(isRange(e.target)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){interacting.current=true;setResizing(true);}}}
    onKeyUpCapture={e=>{if(isRange(e.target))finish();}}
    onBlurCapture={e=>{if(isRange(e.target))finish();}}>
    <PergolaFootprint input={input} displayInput={live} roof={roof} activeDimension={activeDimension} resizing={resizing}/>
    <div className={`${css.controls} ${css.sizeControls}`}>
      <PreviewControls mode="size" input={live} roof={roof} onChange={next=>{
        setLive(next);
        if(interacting.current)pending.current=next;
        else {pending.current=null;setInput(next);}
      }} onRoofChange={setRoof} onDimensionActivity={showDimension}/>
      <MobileSiteChoices input={input} roof={roof} setInput={setInput} setRoof={setRoof}/>
    </div>
  </div>;
}
