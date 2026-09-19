'use client';
import { useRef, type ReactNode } from 'react';
import type { PreviewRoofChoices } from './GableChoices';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { mobileSidePresets, sideConfigurationKey } from './mobileSidePresets';
import css from './mobileSideLooks.module.css';

export default function MobileSideLooks({ roof, onChange, preview, children }: {
  roof: PreviewRoofChoices; onChange: (roof: PreviewRoofChoices) => void; preview: ReactNode; children: ReactNode;
}) {
  const workspace = usePreviewBlinds()!;
  const looks = mobileSidePresets(roof, workspace.openings);
  const index = looks.findIndex(look => sideConfigurationKey(look.roof) === sideConfigurationKey(roof));
  const current = looks[index];
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  function move(direction: number) {
    const next = index < 0 ? (direction > 0 ? 0 : looks.length - 1) : (index + direction + looks.length) % looks.length;
    onChange(looks[next].roof);
  }
  return <section className={css.looks} aria-label="Side configurations" aria-roledescription="carousel">
    <div className={css.viewport}>
      <div className={css.preview}>{preview}</div>
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
    </div>
    <div className={css.description} aria-live="polite" aria-atomic="true">
      <p className={css.count}>{index < 0 ? `${looks.length} suggested looks` : `${index + 1} of ${looks.length}`}</p>
      <h2>{current?.name ?? 'Your combination'}</h2>
    </div>
    <details className={css.customise} onToggle={event => { if (!event.currentTarget.open) workspace.setEditing(false); }}>
      <summary>Customise sides</summary>
      {children}
    </details>
  </section>;
}
