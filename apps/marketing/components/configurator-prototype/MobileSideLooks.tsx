'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import type { useSideLookComparison } from './useSideLookComparison';
import css from './mobileSideLooks.module.css';
import MobileSideSummary from './MobileSideSummary';

export default function MobileSideLooks({ roof, comparison, preview, estimate, children }: {
  roof: PreviewRoofChoices; comparison: ReturnType<typeof useSideLookComparison>; preview: ReactNode; estimate: ReactNode; children: ReactNode;
}) {
  const workspace = usePreviewBlinds()!;
  const [editing, setEditing] = useState(false);
  const section = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const { looks, index, move } = comparison;
  const current = looks[index];
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    if (!editing) return;
    const dialog = section.current?.closest('dialog');
    const cancel = (event: Event) => {
      event.preventDefault(); setEditing(false); workspace.setEditing(false);
      section.current?.closest('[data-journey-content]')?.scrollTo({ top: 0, behavior: 'instant' });
      toggle.current?.focus();
    };
    dialog?.addEventListener('cancel', cancel);
    return () => dialog?.removeEventListener('cancel', cancel);
  }, [editing, workspace]);
  function edit(value: boolean) {
    setEditing(value); workspace.setEditing(false);
    section.current?.closest('[data-journey-content]')?.scrollTo({ top: 0, behavior: 'instant' });
  }
  return <section ref={section} className={css.looks} data-editing={editing} aria-label="Side configurations" aria-roledescription={editing ? undefined : 'carousel'}>
    <div className={css.viewport}>
      <div className={css.preview}>{preview}</div>
      {!editing && <>
        <div className={css.swipe} aria-hidden="true"
          onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerCancel={() => { pointer.current = null; }}
          onPointerUp={event => {
            const start = pointer.current; pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x, dy = event.clientY - start.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1);
          }} />
        {[-1, 1].map(direction => <button key={direction} className={direction < 0 ? css.previous : css.next}
          aria-label={`${direction < 0 ? 'Previous' : 'Next'} side configuration`} onClick={() => move(direction)} disabled={looks.length < 2}
          onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction < 0 ? 'M15 4 7 12l8 8' : 'm9 4 8 8-8 8'} /></svg>
        </button>)}
      </>}
    </div>
    {!editing && <>
      <div className={css.description} aria-live="polite" aria-atomic="true">
        <p className={css.count}>{index < 0 ? 'Custom' : `${index + 1} of ${looks.length}`}</p>
        <h2>{current?.name ?? 'Your combination'}</h2>
        <MobileSideSummary roof={roof}/>
      </div>
      <div className={css.comparisonActions}>
        {current?.id === 'privacy' && <button onClick={comparison.flipPrivacy}>Use {comparison.privacySide === 'left' ? 'right' : 'left'} side</button>}
        {comparison.hasCustom && !comparison.isCustom && <button onClick={comparison.restore}>Return to your combination</button>}
      </div>
      {estimate}
    </>}
    <button ref={toggle} className={css.editToggle} aria-expanded={editing} aria-controls="mobile-side-editor" onClick={() => edit(!editing)}>{editing ? 'Done editing sides' : 'Customise sides'}<span aria-hidden="true">{editing ? '−' : '+'}</span></button>
    {editing && <div id="mobile-side-editor" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); edit(false); toggle.current?.focus(); } }}>{children}{estimate}</div>}
  </section>;
}
