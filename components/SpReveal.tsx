'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';

type SpRevealProps = {
  id?: string;
  sentence: string;
  holdFrac?: number; // 0..0.8
  scrollSpan?: string; // e.g. '240vh'
  edge?: string; // e.g. 'clamp(16px,6vw,96px)' or 'var(--g)'
  ink?: string; // text color, e.g. 'var(--fg)'
  imageSrc?: string;
  imageAlt?: string;
  imageSizes?: string;
  images?: string[]; // optional multi-image sequence for hold phase
  className?: string;
  style?: React.CSSProperties;
  // Flow mode renders as a normal scrolling section (no sticky/lock, no image pause)
  flow?: boolean;
};

export default function SpReveal({
  id = 'sp-reveal-1',
  sentence,
  holdFrac = 0.2,
  scrollSpan = '240vh',
  edge = 'var(--g)',
  ink = 'var(--fg)',
  imageSrc,
  imageAlt = 'Project image',
  imageSizes = '(max-width: 960px) 100vw, 60vw',
  images,
  className,
  style,
  flow = true,
}: SpRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const imageFillRef = useRef<HTMLDivElement | null>(null);
  const imgRefs = useRef<HTMLDivElement[]>([]);

  // Measure the center of the "Products" nav item on desktop and
  // align the split seam (image left edge) to that x-position.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const calcSeam = () => {
      const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches;
      if (!isDesktop) {
        root.style.removeProperty('--sp-seam');
        return;
      }
      const prod = document.getElementById('nav-products');
      if (!prod) {
        root.style.removeProperty('--sp-seam');
        return;
      }
      const r = prod.getBoundingClientRect();
      const seam = Math.round(r.left + r.width / 2); // px from viewport left
      // keep within viewport bounds
      const seamPx = Math.max(280, Math.min(window.innerWidth - 280, seam));
      root.style.setProperty('--sp-seam', seamPx + 'px');
    };

    calcSeam();
    window.addEventListener('resize', calcSeam);
    return () => window.removeEventListener('resize', calcSeam);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    if (!root || !line) return;

    const HOLD_FRAC = flow ? 0 : Math.max(0, Math.min(0.8, holdFrac ?? 0));

    const sent = (sentence || '').trim();
    if (!sent) {
      line.textContent = '';
      return;
    }

    // Reduced motion: show full sentence and bail
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      line.textContent = sent;
      return;
    }

    // Build tokens
    while (line.firstChild) line.removeChild(line.firstChild);
    sent.split(' ').forEach((t) => {
      const w = document.createElement('span');
      w.className = 'sp-reveal__word';
      w.textContent = t;
      line.appendChild(w);
    });

    const words = Array.from(line.querySelectorAll<HTMLElement>('.sp-reveal__word'));
    const N = words.length;
    // If scrollSpan is 'auto', expand section height based on word count
    try {
      if (String(scrollSpan).toLowerCase() === 'auto') {
        // Base + per-word heuristic, clamped
        const base = 300; // vh
        const perWord = 6; // vh per word
        const spanVH = Math.max(base, Math.min(1400, base + N * perWord));
        root.style.setProperty('--sp-scroll', spanVH + 'vh');
      }
    } catch {}
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    const progress = () => {
      if (flow) {
        // Reveal begins very low in the viewport so words start appearing
        // as you approach the section; completes at the viewport center.
        const lr = line.getBoundingClientRect();
        const lc = lr.top + lr.height / 2; // line center Y
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const vpCenter = vh / 2;
        const startY = Math.round(vh * 2.2); // start slightly later (~220% below top)
        const endY = vpCenter; // finish at center
        if (lc >= startY) return 0;    // not started yet
        if (lc <= endY) return 1;      // fully on once past center
        const span = Math.max(1, startY - endY);
        const t = (startY - lc) / span; // 0 at startY .. 1 at center
        return clamp(t, 0, 1);
      }
      const rect = root.getBoundingClientRect();
      const span = root.offsetHeight - window.innerHeight;
      return clamp(-rect.top / Math.max(1, span), 0, 1); // 0..1
    };

    // Reserve an initial slice of scroll to bring the image into place
    // before text begins to reveal.
    const REVEAL_START = flow ? 0 : 0.04; // no early start in flow mode

    const phaseFor = (p: number) => {
      // Flow mode: single continuous reveal/hide tied to scroll.
      // As you scroll down (p increases 0->1), words appear one by one.
      // Scrolling up (p decreases), they hide one by one in reverse.
      if (flow) {
        return { phase: 'reveal' as const, t: clamp(p, 0, 1) };
      }
      const rEnd = 0.5 - HOLD_FRAC / 2; // reveal end
      const hEnd = 0.5 + HOLD_FRAC / 2; // hold end
      if (p <= rEnd) return { phase: 'reveal' as const, t: p / Math.max(1e-6, rEnd) };
      if (p < hEnd) return { phase: 'hold' as const, t: 1 };
      return { phase: 'hide' as const, t: (p - hEnd) / Math.max(1e-6, 1 - hEnd) };
    };

    let lastPhase: 'reveal' | 'hold' | 'hide' | '' = '';
    let lastK = -1;

    // Compute the image gap as the same inset used on the sides of the image box.
    // We read the resolved 'left' from the image pad (which equals --sp-edge) and
    // convert it to a percentage of the image container height so we can add it
    // to our translate percentages.
    const padEl = root.querySelector<HTMLDivElement>('.sp-reveal__imagepad');
    const fillEl = root.querySelector<HTMLDivElement>('.sp-reveal__imagefill');
    let gapPct = 0; // percentage of container height
    const computeGap = () => {
      if (!padEl || !fillEl) { gapPct = 0; return; }
      const cs = getComputedStyle(padEl);
      const leftPx = parseFloat(cs.left || '0');
      const H = fillEl.getBoundingClientRect().height || 1;
      gapPct = Math.max(0, (leftPx / H) * 100);
    };
    computeGap();

    const render = () => {
      const pRaw = progress();

      // Delay text until after initial image settle-in
      const p = Math.max(0, Math.min(1, (pRaw - REVEAL_START) / Math.max(1e-6, 1 - REVEAL_START)));
      const { phase, t } = phaseFor(p);
      // Bias word appearances toward the viewport center in flow mode,
      // so most of the transition happens around the center line.
      const bias = (x: number) => {
        // Slow the per-word stepping to ~half speed in flow mode
        // while still reaching full sentence at center.
        return flow ? Math.min(1, Math.pow(x, 2)) : x;
      };
      const k =
        phase === 'reveal'
          ? Math.floor(bias(t) * N + 1e-4)
          : phase === 'hold'
          ? N
          : Math.max(0, Math.floor((1 - t) * N + 1e-4)); // hide from start

      // Compute hold sub-progress for image sequence (no magnetic lag)
    const rEnd = flow ? 0.5 : 0.5 - HOLD_FRAC / 2;
    const hEnd = flow ? 1.0 : 0.5 + HOLD_FRAC / 2;
      let hp = 0;
      if (p <= rEnd) hp = 0;
      else if (p >= hEnd) hp = 1;
      else hp = (p - rEnd) / Math.max(1e-6, hEnd - rEnd);

      // Update image transforms directly from hp
      if (!flow && images && images.length >= 2 && imgRefs.current.length) {
        const n = images.length;
        const seg = 1 / (n - 1);
        const segIdx = Math.min(n - 2, Math.max(0, Math.floor(hp / seg)));
        const localT = Math.max(0, Math.min(1, (hp - segIdx * seg) / seg));
        const step = 100 + gapPct; // include gap between slides
        imgRefs.current.forEach((el, i) => {
          if (!el) return;
          let y: number;
          if (i < segIdx) y = -step;
          else if (i === segIdx) y = -step * localT;
          else if (i === segIdx + 1) y = step * (1 - localT);
          else y = step;
          el.style.transform = `translate3d(0, ${y}%, 0)`;
        });
      }

      if (phase === lastPhase && k === lastK) return;
      lastPhase = phase;
      lastK = k;

      if (phase === 'reveal') {
        for (let i = 0; i < N; i++) words[i].classList.toggle('is-on', i < k);
      } else if (phase === 'hold') {
        for (let i = 0; i < N; i++) words[i].classList.add('is-on');
      } else {
        const start = N - k; // keep last k words
        for (let i = 0; i < N; i++) words[i].classList.toggle('is-on', i >= start);
      }
    };

    render();
    window.addEventListener('scroll', render, { passive: true });
    const onResize = () => { computeGap(); render(); };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', render);
      window.removeEventListener('resize', onResize);
    };
  }, [sentence, holdFrac, images, flow]);

  // In flow mode, scale the text so its block height spans from the
  // top of the first image to the bottom of the last image.
  useEffect(() => {
    if (!flow) return;
    const root = rootRef.current;
    const line = lineRef.current;
    const fill = imageFillRef.current;
    if (!root || !line || !fill) return;

    let raf = 0;
    const TOL = 4; // px tolerance
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    const measureH = () => ({
      target: Math.round(fill.getBoundingClientRect().height),
      current: Math.round(line.getBoundingClientRect().height),
      size: parseFloat(getComputedStyle(line).fontSize || '24') || 24,
    });

    const tune = (remaining: number) => {
      const { target, current, size } = measureH();
      if (target <= 0 || current <= 0) return;
      const delta = target - current;
      if (Math.abs(delta) <= TOL || remaining <= 0) return;
      // scale proportionally; cap to sensible bounds
      const next = clamp(size * (target / current), 10, 220);
      root.style.setProperty('--sp-size', `${next}px`);
      raf = window.requestAnimationFrame(() => tune(remaining - 1));
    };

    // Kick after layout settles
    raf = window.requestAnimationFrame(() => tune(6));
    const onResize = () => { cancelAnimationFrame(raf); raf = window.requestAnimationFrame(() => tune(6)); };
    window.addEventListener('resize', onResize, { passive: true });
    return () => { try { cancelAnimationFrame(raf); } catch {} window.removeEventListener('resize', onResize); };
  }, [flow, images, sentence]);

  type CSSVarProps = React.CSSProperties & {
    '--sp-scroll'?: string;
    '--sp-edge'?: string;
    '--sp-ink'?: string;
    '--sp-gutter'?: string;
    '--sp-size'?: string;
  };

  const styleVars: CSSVarProps = {
    ...style,
    '--sp-scroll': scrollSpan,
    '--sp-edge': edge,
    '--sp-ink': ink,
  };

  return (
    <section
      className={`sp-reveal${flow ? ' sp-flow' : ''}${className ? ` ${className}` : ''}`}
      id={id}
      style={styleVars}
      ref={rootRef}
      aria-label="Statement"
    >
      <div className="sp-reveal__sticky">
        <div className="sp-reveal__text">
          <div className="sp-reveal__linebox">
            <div className="sp-reveal__line" ref={lineRef} />
          </div>
        </div>
        {images && images.length ? (
          <div className="sp-reveal__imagebox" aria-hidden>
            <div className="sp-reveal__imagepad">
              <div className="sp-reveal__imagefill" ref={imageFillRef}>
                {images.map((src, i) => (
                  <div
                    className="sp-reveal__img"
                    key={`spimg-${i}`}
                    ref={(el) => { if (el) imgRefs.current[i] = el; }}
                    style={{ transform: i === 0 ? 'translate3d(0,0,0)' : 'translate3d(0,100%,0)' }}
                  >
                    <Image
                      src={src}
                      alt={imageAlt}
                      fill
                      sizes={imageSizes}
                      priority={i === 0}
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : imageSrc ? (
          <div className="sp-reveal__imagebox" aria-hidden>
            <div className="sp-reveal__imagepad">
              <div className="sp-reveal__imagefill">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  sizes={imageSizes}
                  priority={false}
                  style={{ objectFit: 'cover' }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
