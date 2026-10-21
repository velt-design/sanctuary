/** Defer an asynchronous treatment while a visitor is pointing or focusing a
 * hero action. No control is remounted and a held finger keeps its target. */
export function landingPaintGate(signal:AbortSignal) {
  const pointers=new Set<number>();let release:(()=>void)|undefined;
  const down=(event:PointerEvent)=>pointers.add(event.pointerId);
  const ready=()=>pointers.size===0&&!document.activeElement?.closest('[data-landing-copy="layout"] a');
  const check=()=>{if(ready())release?.();};
  const up=(event:PointerEvent)=>{pointers.delete(event.pointerId);requestAnimationFrame(check);};
  const blur=()=>requestAnimationFrame(check);
  window.addEventListener('pointerdown',down,{capture:true,signal});
  window.addEventListener('pointerup',up,{capture:true,signal});
  window.addEventListener('pointercancel',up,{capture:true,signal});
  window.addEventListener('focusout',blur,{signal});
  return async()=>{
    signal.throwIfAborted();
    if(!ready())await new Promise<void>((resolve,reject)=>{release=resolve;signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
    signal.throwIfAborted();
  };
}
