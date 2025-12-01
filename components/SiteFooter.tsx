// components/SiteFooter.tsx
/* eslint-disable @next/next/no-img-element */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';

const ANCHOR_RX_GUESS = 0.56;

export default function SiteFooter() {
  const mapRef = useRef<HTMLImageElement | null>(null);
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);

  // Approximate position of Māngere (Auckland) within the NZ SVG
  // Values are percentages of the SVG's viewBox (x in [0..1], y in [0..1]).
  // Tunable if you want to nudge the line later.
  // Dynamic Auckland anchor, snapped to the isthmus
  const [anchorRx, setAnchorRx] = useState(ANCHOR_RX_GUESS); // initial guess (right-ish)
  const [anchorRy, setAnchorRy] = useState(0.36); // initial guess (upper third)

  useEffect(() => {
    const calc = () => {
      const el = mapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPt({ x: r.left + r.width * anchorRx, y: r.top + r.height * anchorRy });
    };
    calc();
    const on = () => calc();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on);
    };
  }, [anchorRx, anchorRy]);

  // Inset line from the left edge for breathing space
  const LINE_INSET = 240; // px – stop further from left edge

  // Westward line: from left edge towards the Māngere point
  const lineStyle: CSSProperties | undefined = pt
    ? {
        position: 'fixed',
        left: LINE_INSET,
        top: pt.y,
        width: Math.max(0, pt.x - LINE_INSET),
        height: '2px',
        background: 'var(--accentRed, #813F39)',
        zIndex: 1,
      }
    : undefined;

  // Label sits just below the left end of the line
  const labelStyle: CSSProperties | undefined = pt
    ? {
        position: 'fixed',
        left: LINE_INSET,
        top: pt.y + 12,
        color: '#f5f6f7',
        textAlign: 'left',
        lineHeight: 1.35,
        fontSize: '14px',
        whiteSpace: 'pre-line',
        zIndex: 2,
      }
    : undefined;

  // Compute the skinniest horizontal cross‑section near the Auckland isthmus
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/nz.svg');
        const svg = await res.text();
        const vb = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number);
        const d = /<path[^>]*d="([^"]+)"/i.exec(svg)?.[1];
        if (!vb || !d) return;
        const [, , vbW, vbH] = vb; // assumes minX=minY=0

        // Draw path onto an offscreen canvas and scan rows near Auckland
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vbW);
        canvas.height = Math.round(vbH);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const path = new Path2D(d);

        // Search a vertical window around a visual Auckland band (upper‑mid of NZ)
        const yMin = Math.round(vbH * 0.30);
        const yMax = Math.round(vbH * 0.48);
        const stepY = 1;
        const stepX = 2; // speedup without losing accuracy

        let best = { y: 0, left: 0, right: vbW, width: vbW };

        for (let y = yMin; y <= yMax; y += stepY) {
          let inside = false;
          let start = 0;
          const spans: Array<[number, number]> = [];
          for (let x = 0; x <= vbW; x += stepX) {
            const hit = ctx.isPointInPath(path, x, y);
            if (hit && !inside) { inside = true; start = x; }
            else if (!hit && inside) { inside = false; spans.push([start, x]); }
          }
          if (inside) spans.push([start, vbW]);

          // Choose spans whose centre is near our rough Auckland guess
          const guessX = ANCHOR_RX_GUESS * vbW;
          const near = vbW * 0.18; // +/- 18% of width
          const candidates = spans
            .map(([l, r]) => ({ l, r, w: r - l, c: (l + r) / 2 }))
            .filter(s => Math.abs(s.c - guessX) <= near && s.w > 8); // ignore tiny slivers

          if (candidates.length === 0) continue;

          // Find the skinniest candidate for this row
          const rowSkinny = candidates.reduce((a, b) => (b.w < a.w ? b : a));
          if (rowSkinny.w < best.width) {
            best = { y, left: rowSkinny.l, right: rowSkinny.r, width: rowSkinny.w };
          }
        }

        if (!cancelled && best.width < vbW) {
          setAnchorRx((best.left + best.right) / 2 / vbW);
          setAnchorRy(best.y / vbH);
        }
      } catch {
        // ignore; fallback ratios remain
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <footer className="bg-[#121212] text-[#f5f6f7] min-h-[100dvh] flex items-center justify-center relative">
      {/* Accurate NZ silhouette from Natural Earth, simplified for clean lines */}
      <img ref={mapRef} src="/nz.svg" alt="" aria-hidden="true" className="w-[min(72vw,620px)] h-auto opacity-85" />

      {/* Auckland → east red line */}
      {pt && <div aria-hidden="true" style={lineStyle} />}
      {/* Copy aligned to the line end */}
      {pt && (
        <div style={labelStyle}>
          Warehouse
          {'\n'}71G Montgomerie Road
          {'\n'}Māngere, Auckland 2022
          {'\n'}New Zealand
        </div>
      )}

      {/* Footer links (privacy + social) */}
      <nav aria-label="Footer" className="absolute left-6 bottom-6 text-sm opacity-85">
        <div className="flex flex-col gap-1">
          <Link href="/privacy" className="underline underline-offset-4 lg:hover:opacity-80">
            Privacy Policy
          </Link>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/sanctuarypergolas/"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 lg:hover:opacity-80"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/SanctuaryPergolas"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 lg:hover:opacity-80"
            >
              Facebook
            </a>
          </div>
        </div>
      </nav>
    </footer>
  );
}
