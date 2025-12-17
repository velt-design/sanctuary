// components/Gallery/OriginalViewer.tsx
'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type GalleryImage = {
  src: string;
  alt?: string;
  fallbackJpg?: string;
};

type Mode = 'slider' | 'fullscreen';

type Props = {
  images: GalleryImage[];
  defaultMode?: Mode;
  showScrubber?: boolean;
};

export default function OriginalViewer({ images, defaultMode = 'slider', showScrubber = false }: Props) {
  const [mode] = useState<Mode>(defaultMode);
  const [index, setIndex] = useState(0);
  const slidesRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [slideW, setSlideW] = useState(0);
  const [gapW, setGapW] = useState(0);
  const [stageW, setStageW] = useState(0);

  const count = images.length;
  const clampIndex = useCallback((i: number) => Math.max(0, Math.min(count - 1, i)), [count]);

  const goto = useCallback((i: number) => setIndex(clampIndex(i)), [clampIndex]);
  const next = useCallback(() => goto(index + 1), [index, goto]);
  const prev = useCallback(() => goto(index - 1), [index, goto]);

  // Measure a single slide width so transforms work with whatever CSS width is in use
  const measure = useCallback(() => {
    const el = slidesRef.current?.querySelector<HTMLDivElement>('.slide');
    const slides = slidesRef.current;
    const stage = stageRef.current;
    if (!el || !slides || !stage) return;

    const slideRect = el.getBoundingClientRect();
    setSlideW(slideRect.width || 0);

    const cs = getComputedStyle(slides);
    // Read the horizontal gap (flex gap); fall back to 0 if unavailable
    const gapStr = (cs as CSSStyleDeclaration & { gap?: string }).gap || cs.columnGap || '0px';
    const parsed = parseFloat(String(gapStr).replace('px', ''));
    setGapW(isFinite(parsed) ? parsed : 0);

    const stageRect = stage.getBoundingClientRect();
    setStageW(stageRect.width || 0);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, mode]);

  useEffect(() => {
    const h = () => measure();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const translateX = useMemo(() => {
    const slideWidth = slideW;
    const viewerWidth = stageW || stageRef.current?.getBoundingClientRect().width || 0;
    const step = Math.max(0, slideWidth + (gapW || 0));
    if (!slideWidth || !viewerWidth || !step) return 0;
    // Center the active slide: its midpoint aligns with the viewer midpoint.
    const offsetToCenter = viewerWidth / 2 - slideWidth / 2;
    return offsetToCenter - index * step;
  }, [index, slideW, gapW, stageW]);

  // Scrubber interactions
  const applyRatio = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    const i = Math.round(r * Math.max(0, count - 1));
    setIndex(i);
  }, [count]);

  const onScrub = useCallback((clientX: number) => {
    const bar = barRef.current; if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = (clientX - rect.left) / Math.max(1, rect.width);
    applyRatio(ratio);
  }, [applyRatio]);

  const onBarPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setScrubbing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onScrub(e.clientX);
  }, [onScrub]);

  const onBarPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return;
    onScrub(e.clientX);
  }, [scrubbing, onScrub]);

  const onBarPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setScrubbing(false);
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, []);

  return (
    <div className={`viewer mode-${mode}`}>
      <div ref={stageRef} className="stage">
        <div
          ref={slidesRef}
          className="slides"
          style={{ transform: `translate3d(${translateX}px, 0, 0)` }}
        >
          {images.map((img, i) => (
            <div className="slide" key={`${img.src}-${i}`}>
              <div
                className="slide-media"
                style={{ aspectRatio: '16 / 9' }}
              >
                <img src={img.src} alt={img.alt || `Image ${i + 1}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional scrubber placeholder (hidden by default) */}
      {showScrubber && (
        <div className="scrubber" aria-hidden="false">
          <div
            ref={barRef}
            className="bar"
            onPointerDown={onBarPointerDown}
            onPointerMove={onBarPointerMove}
            onPointerUp={onBarPointerUp}
          >
            <div
              className="playhead"
              style={{ left: `${(index / Math.max(1, count - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Click zones for simple navigation */}
      <div className="nav-zones">
        <button type="button" className="nav-zone left" aria-label="Previous" onClick={prev} />
        <button type="button" className="nav-zone right" aria-label="Next" onClick={next} />
      </div>
    </div>
  );
}
