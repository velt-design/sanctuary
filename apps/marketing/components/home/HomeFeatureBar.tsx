'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeatureItem } from '@/components/home/HomePageClient';

type HomeFeatureBarProps = {
  featureItems: FeatureItem[];
};

export default function HomeFeatureBar({ featureItems }: HomeFeatureBarProps) {
  const [bubblePlacement, setBubblePlacement] = useState<'above' | 'below'>('below');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openTimerRef = useRef<number | null>(null);

  const clearOpenTimer = () => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const handleEnter = (index: number) => {
    setActiveIndex(index);
    clearOpenTimer();
    setOpenIndex(null);
    openTimerRef.current = window.setTimeout(() => setOpenIndex(index), 180);
  };

  const handleLeave = () => {
    clearOpenTimer();
    setActiveIndex(null);
    setOpenIndex(null);
  };

  useEffect(() => {
    return () => clearOpenTimer();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bar = document.getElementById('feature-bar');
    if (!bar) return;

    let rafId = 0;

    const updatePlacement = () => {
      rafId = 0;
      const cs = getComputedStyle(bar);
      if (cs.display === 'none' || bar.offsetHeight === 0) return;
      const rect = bar.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const viewportMid = (window.innerHeight || document.documentElement.clientHeight || 0) / 2;
      const next: 'above' | 'below' = center <= viewportMid ? 'below' : 'above';
      setBubblePlacement((prev) => (prev === next ? prev : next));
    };

    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updatePlacement);
    };

    updatePlacement();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="feature-zone" id="feature-zone">
      <div
        className="feature-bar"
        id="feature-bar"
        aria-label="Key features"
        data-bubble-placement={bubblePlacement}
        data-dim={activeIndex === null ? 'false' : 'true'}
      >
        <div className="container" role="list">
          {featureItems.map((item, index) => (
            <span
              className="dot"
              role="listitem"
              key={item.label}
              data-active={activeIndex === index ? 'true' : 'false'}
              data-open={openIndex === index ? 'true' : 'false'}
              onMouseEnter={() => handleEnter(index)}
              onMouseLeave={handleLeave}
            >
              <span className="dot-label">{item.label}</span>
              <span className="feature-bubble" role="tooltip">
                {item.bubble}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
