'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';

type Token = { type: 'word'; text: string; className?: string } | { type: 'br' };

type SpRevealProps = {
  id?: string;
  sentence: string;
  edge?: string;
  ink?: string;
  imageSrc?: string;
  imageAlt?: string;
  imageSizes?: string;
  images?: string[];
  className?: string;
  style?: React.CSSProperties;
  fitTextToImages?: boolean;
};

const ACCENT_WORDS = new Set(['designed', 'pergolas']);
const KEY_WORDS = new Set(['beautiful', 'sanctuary']);

const classNameForWord = (text: string): string | undefined => {
  const base = text.replace(/[\.,!\?\u2026\u2014\u2013\-]+$/g, '').toLowerCase();
  if (ACCENT_WORDS.has(base)) return 'is-accent';
  if (KEY_WORDS.has(base)) return 'is-key';
  return undefined;
};

const parseSentence = (sentence: string): Token[] => {
  const sent = (sentence || '').trim();
  if (!sent) return [];
  const tokens: Token[] = [];
  let buffer = '';
  let inGroup = false;

  const flush = () => {
    const text = buffer.trim();
    if (text) tokens.push({ type: 'word', text, className: classNameForWord(text) });
    buffer = '';
  };

  for (let i = 0; i < sent.length; i++) {
    const ch = sent[i];
    if (!inGroup && ch === '|') {
      flush();
      tokens.push({ type: 'br' });
      continue;
    }
    if (ch === '{') {
      if (!inGroup) {
        flush();
        inGroup = true;
        continue;
      }
    }
    if (ch === '}' && inGroup) {
      flush();
      inGroup = false;
      continue;
    }
    if (!inGroup && /\s/.test(ch)) {
      if (buffer.length) flush();
      continue;
    }
    buffer += ch;
  }
  flush();
  return tokens;
};

export default function SpReveal({
  id = 'sp-reveal-1',
  sentence,
  edge = 'var(--g)',
  // slightly darker light grey for sentence body
  ink = '#AEB4BA',
  imageSrc,
  imageAlt = 'Project image',
  imageSizes = '(max-width: 960px) 100vw, 60vw',
  images,
  className,
  style,
  fitTextToImages = true,
}: SpRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const imageFillRef = useRef<HTMLDivElement | null>(null);

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

  const tokens = useMemo(() => parseSentence(sentence), [sentence]);

  // Auto-fit the text column height to the image stack height
  const imageCount = images?.length ?? (imageSrc ? 1 : 0);
  useEffect(() => {
    if (!fitTextToImages) return;
    const root = rootRef.current;
    const line = lineRef.current;
    const fill = imageFillRef.current;
    if (!root || !line || !fill) return;

    let raf = 0;
    const TOL = 1; // px tolerance
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

    const measureH = () => ({
      target: (() => {
        const fr = fill.getBoundingClientRect();
        const nudgeStr = getComputedStyle(root).getPropertyValue('--sp-fit-nudge');
        const nudge = parseFloat(nudgeStr || '0') || 0;
        return Math.max(0, Math.round(fr.height + nudge));
      })(),
      current: Math.round(line.getBoundingClientRect().height),
      size: parseFloat(getComputedStyle(line).fontSize || '24') || 24,
    });

    const tune = (remaining: number) => {
      const { target, current, size } = measureH();
      if (target <= 0 || current <= 0) return;
      const delta = target - current;
      if (Math.abs(delta) <= TOL || remaining <= 0) return;
      const next = clamp(size * (target / current), 10, 220);
      root.style.setProperty('--sp-size', `${next}px`);
      raf = window.requestAnimationFrame(() => tune(remaining - 1));
    };

    raf = window.requestAnimationFrame(() => tune(12));
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => tune(12));
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      try {
        cancelAnimationFrame(raf);
      } catch {}
      window.removeEventListener('resize', onResize);
    };
  }, [fitTextToImages, sentence, imageCount]);

  const styleVars = {
    ...style,
    '--sp-edge': edge,
    '--sp-ink': ink,
  } as React.CSSProperties & {
    '--sp-edge'?: string;
    '--sp-ink'?: string;
  };

  const classNames = ['sp-reveal', 'sp-flow'];
  if (className) classNames.push(className);

  return (
    <section
      className={classNames.join(' ')}
      id={id}
      style={styleVars}
      ref={rootRef}
      aria-label="Statement"
    >
      <div className="sp-reveal__sticky">
        <div className="sp-reveal__text">
          <div className="sp-reveal__linebox">
            <div className="sp-reveal__line" ref={lineRef}>
              {tokens.length === 0
                ? null
                : tokens.map((token, idx) =>
                    token.type === 'br' ? (
                      <br key={`br-${idx}`} className="sp-reveal__br" />
                    ) : (
                      <span
                        key={`word-${idx}`}
                        className={`sp-reveal__word${token.className ? ` ${token.className}` : ''}`}
                      >
                        {token.text}
                      </span>
                    )
                  )}
            </div>
          </div>
        </div>
        {images && images.length ? (
          <div className="sp-reveal__imagebox" aria-hidden>
            <div className="sp-reveal__imagepad">
              <div className="sp-reveal__imagefill" ref={imageFillRef}>
                {images.map((src, i) => (
                  <div className="sp-reveal__img" key={`spimg-${i}`}>
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
              <div className="sp-reveal__imagefill" ref={imageFillRef}>
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
