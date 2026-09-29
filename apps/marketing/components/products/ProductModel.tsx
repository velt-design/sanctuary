'use client';
import LightingProvider, { useLighting } from '../configurator-prototype/LightingProvider';
import RailProvider from '../configurator-prototype/RailProvider';
import PreviewBlindProvider from '../configurator-prototype/PreviewBlindProvider';
import PreviewViews from '../configurator-prototype/PreviewViews';
import type { PreviewDraft } from '../configurator-prototype/previewDraft';
import type { ProductRecord } from '@/data/products';
import PergolaFootprint from '../configurator-prototype/PergolaFootprint';
import { ResponsiveGallery } from '../marketing-foundation/ResponsiveGallery';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProductPreviewPoster from './ProductPreviewPoster';
import styles from './product-selection.module.css';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { lockPageScroll } from '../marketing-foundation/pageScrollLock';

const noChange = () => {};
function ModelView({ draft, gallery, mode, onModeChange, onFullscreen, onReady, resizing = false }: { resizing?: boolean; draft: PreviewDraft; gallery: ProductRecord['gallery']; mode: 'Photos' | 'Design' | 'Plan'; onModeChange: (mode: 'Photos' | 'Design' | 'Plan') => void; onFullscreen: (open: boolean) => void; onReady?: () => void }) {
  const lighting = useLighting()!;
  const built = mode === 'Photos';
  useEffect(() => { if (mode !== 'Photos') lighting.setView(mode === 'Plan' ? 'Plan' : '3D'); }, [mode, lighting.setView]);
  const [sceneReady, setSceneReady] = useState(false);
  const markReady = useCallback(() => { setSceneReady(true); onReady?.(); }, [onReady]);
  const [fullscreen, setFullscreen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const openingScroll = useRef<number | null>(null);
  useEffect(() => { if (built || lighting.view === 'Plan') onReady?.(); }, [built, lighting.view, onReady]);
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
  return <><div className={styles.viewTabs} role="group" aria-label="Model view">{(['Photos', 'Design', 'Plan'] as const).map(view => <button key={view} aria-pressed={mode === view} onClick={() => onModeChange(view)}>{view}</button>)}</div>
    <dialog ref={dialog} className={styles.modelDialog} role={fullscreen ? 'dialog' : 'group'} aria-modal={fullscreen || undefined} aria-label="Explore your pergola" onCancel={event => { event.preventDefault(); setFullscreen(false); }} onClose={() => setFullscreen(false)} hidden={built}>
      {fullscreen && <div className={styles.fullscreenHeader}><span>Your pergola</span><button autoFocus aria-label="Close fullscreen 3D" onClick={() => setFullscreen(false)}>×</button></div>}
      <div className={styles.modelBody}>
      {fullscreen && !sceneReady && lighting.view === '3D' && <ProductPreviewPoster type={draft.roof.family === 'mono' ? 'pitched' : draft.roof.family === 'gable' ? 'gable' : 'box-perimeter'}/>}
      {lighting.view === 'Plan' ? <div className={styles.footprint}><PergolaFootprint resizing={resizing} input={draft.input} roof={draft.roof} activeDimension={null}/></div> : <PreviewViews onViewChange={view => onModeChange(view === 'Plan' ? 'Plan' : 'Design')} onReady={markReady} productPresentation input={draft.input} roof={draft.roof} activeDimension={null} expanded={fullscreen} onToggleExpanded={() => setFullscreen(value => !value)} simple presentation readOnly />}
      </div>
      {!fullscreen && lighting.view === '3D' && <button ref={opener} className={styles.openModel} onPointerDown={() => { openingScroll.current = window.scrollY; }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') openingScroll.current = window.scrollY; }} onClick={() => { lighting.setView('3D'); setFullscreen(true); }} aria-label="Open fullscreen 3D"><span>Tap to explore in 3D <ArrowUpRight/></span></button>}
      {fullscreen && <p className={styles.fullscreenHint}>Drag to rotate · Pinch to zoom</p>}
    </dialog>
    <div className={styles.openingPhotos} hidden={!built}><ResponsiveGallery label="Built pergola photos" swipe items={gallery.map(image => ({ image: image.src, alt: image.alt, caption: image.caption, detail: image.detail, objectPosition: image.objectPosition, ratio: 'landscape', sizes: '(max-width:760px) 100vw, 60vw' }))}/></div>
  </>;
}
export default function ProductModel({ draft, gallery, mode, onModeChange, onFullscreen = noChange, onReady, resizing = false }: { resizing?: boolean; draft: PreviewDraft; gallery: ProductRecord['gallery']; mode: 'Photos' | 'Design' | 'Plan'; onModeChange: (mode: 'Photos' | 'Design' | 'Plan') => void; onFullscreen?: (open: boolean) => void; onReady?: () => void }) {
  return <LightingProvider input={draft.input} roof={draft.roof} onChange={noChange}>
    <RailProvider><PreviewBlindProvider readOnly input={draft.input} roof={draft.roof} onChange={noChange}>
      <ModelView resizing={resizing} draft={draft} gallery={gallery} mode={mode} onModeChange={onModeChange} onFullscreen={onFullscreen} onReady={onReady}/>
    </PreviewBlindProvider></RailProvider>
  </LightingProvider>;
}
