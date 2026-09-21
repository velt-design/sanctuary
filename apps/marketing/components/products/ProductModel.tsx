'use client';
import LightingProvider, { useLighting } from '../configurator-prototype/LightingProvider';
import RailProvider from '../configurator-prototype/RailProvider';
import PreviewBlindProvider from '../configurator-prototype/PreviewBlindProvider';
import PreviewViews from '../configurator-prototype/PreviewViews';
import type { PreviewDraft } from '../configurator-prototype/previewDraft';
import type { ProductRecord } from '@/data/products';
import PergolaFootprint from '../configurator-prototype/PergolaFootprint';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProductPreviewPoster from './ProductPreviewPoster';
import styles from './product-selection.module.css';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { lockPageScroll } from '../marketing-foundation/pageScrollLock';

const noChange = () => {};
function ModelView({ draft, example, onFullscreen, onReady, resizing = false }: { resizing?: boolean; draft: PreviewDraft; example: ProductRecord['hero']; onFullscreen: (open: boolean) => void; onReady?: () => void }) {
  const lighting = useLighting()!;
  const [built, setBuilt] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const markReady = useCallback(() => { setSceneReady(true); onReady?.(); }, [onReady]);
  const [fullscreen, setFullscreen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const openingScroll = useRef<number | null>(null);
  const { setView } = lighting;
  useEffect(() => { if (built || lighting.view === 'Plan') onReady?.(); }, [built, lighting.view, onReady]);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)');
    // Mobile hides the view tabs, so return to the design when crossing into it.
    // Do not reset on draft changes or override the viewer's Plan recovery.
    const restoreDesign = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setBuilt(false);
      setView('3D');
    };
    mobile.addEventListener('change', restoreDesign);
    return () => mobile.removeEventListener('change', restoreDesign);
  }, [setView]);
  useEffect(() => {
    if (!fullscreen) return;
    const element = dialog.current!;
    const scrollY = openingScroll.current ?? window.scrollY;
    openingScroll.current = null;
    const release = lockPageScroll();
    element.showModal();
    onFullscreen(true);
    return () => {
      element.close();
      release();
      onFullscreen(false);
      // Finish after the native dialog has restored its previous focus. Pointer
      // focus can also scroll a partly visible preview before click runs.
      requestAnimationFrame(() => {
        if (!opener.current?.isConnected) return;
        window.scrollTo({ top: scrollY, behavior: 'instant' });
        opener.current.focus({ preventScroll: true });
      });
    };
  }, [fullscreen, onFullscreen]);
  return <><div className={styles.viewTabs} role="group" aria-label="Model view">{(['3D', 'Plan'] as const).map(view => <button key={view} aria-pressed={!built && lighting.view === view} onClick={() => { setBuilt(false); lighting.setView(view); }}>{view === '3D' ? 'Your design' : view}</button>)}<button aria-pressed={built} onClick={() => setBuilt(true)}>Built example</button></div>
    <dialog ref={dialog} className={styles.modelDialog} role={fullscreen ? 'dialog' : 'group'} aria-modal={fullscreen || undefined} aria-label="Explore your pergola" onCancel={event => { event.preventDefault(); setFullscreen(false); }} onClose={() => setFullscreen(false)} hidden={built}>
      {fullscreen && <div className={styles.fullscreenHeader}><span>Your pergola</span><button autoFocus aria-label="Close fullscreen 3D" onClick={() => setFullscreen(false)}>×</button></div>}
      <div className={styles.modelBody}>
      {fullscreen && !sceneReady && lighting.view === '3D' && <ProductPreviewPoster type={draft.roof.family === 'mono' ? 'pitched' : draft.roof.family === 'gable' ? 'gable' : 'box-perimeter'}/>}
      {lighting.view === 'Plan' ? <div className={styles.footprint}><PergolaFootprint resizing={resizing} input={draft.input} roof={draft.roof} activeDimension={null}/></div> : <PreviewViews onReady={markReady} reviewSetting input={draft.input} roof={draft.roof} activeDimension={null} expanded={fullscreen} onToggleExpanded={() => setFullscreen(value => !value)} simple presentation readOnly />}
      </div>
      {!fullscreen && <button ref={opener} className={styles.openModel} onPointerDown={() => { openingScroll.current = window.scrollY; }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openingScroll.current = window.scrollY; }} onClick={() => { lighting.setView('3D'); setFullscreen(true); }} aria-label="Open fullscreen 3D"><span>Tap to explore in 3D <ArrowUpRight/></span></button>}
      {fullscreen && <p className={styles.fullscreenHint}>Drag to rotate · Pinch to zoom</p>}
    </dialog>
    {built && <figure className={styles.builtExample}><Image src={example.src} alt={example.alt} fill sizes="(max-width:760px) 100vw, 60vw" style={{objectFit:'cover',objectPosition:example.objectPosition}}/><figcaption>{example.caption ?? 'A built pergola'} · Project reference, not your selected design</figcaption></figure>}
  </>;
}
export default function ProductModel({ draft, example, onFullscreen = noChange, onReady, resizing = false }: { resizing?: boolean; draft: PreviewDraft; example: ProductRecord['hero']; onFullscreen?: (open: boolean) => void; onReady?: () => void }) {
  return <LightingProvider input={draft.input} roof={draft.roof} onChange={noChange}>
    <RailProvider><PreviewBlindProvider readOnly input={draft.input} roof={draft.roof} onChange={noChange}>
      <ModelView resizing={resizing} draft={draft} example={example} onFullscreen={onFullscreen} onReady={onReady}/>
    </PreviewBlindProvider></RailProvider>
  </LightingProvider>;
}
