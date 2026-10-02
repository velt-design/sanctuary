import { useEffect, useRef } from 'react';

/** Keep a restored tab visible on narrow screens without changing focus or vertical reading position. */
export default function useVisibleSelection(selected:string) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const nav=ref.current?.querySelector('nav');
    if(!nav)return;
    const reveal=()=>{
      const tab=nav.querySelector<HTMLElement>('[aria-selected="true"]');if(!tab)return;
      const viewport=nav.getBoundingClientRect(),item=tab.getBoundingClientRect();
      if(item.left<viewport.left)nav.scrollLeft-=viewport.left-item.left;
      else if(item.right>viewport.right)nav.scrollLeft+=item.right-viewport.right;
    };
    reveal();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(reveal);observer?.observe(nav);
    return()=>observer?.disconnect();
  },[selected]);
  return ref;
}
