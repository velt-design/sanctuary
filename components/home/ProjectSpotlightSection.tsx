'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const SPOTLIGHT_IMAGES = [
  '/images/project-tamaki-dr-01.jpg',
  '/images/project-tamaki-dr-02.jpg',
  '/images/project-tamaki-dr-03.jpg',
  '/images/project-tamaki-dr-04.jpg',
];

export default function ProjectSpotlightSection() {
  const [spotIdx, setSpotIdx] = useState(0);

  const spotPrev = () => setSpotIdx((i) => (i - 1 + SPOTLIGHT_IMAGES.length) % SPOTLIGHT_IMAGES.length);
  const spotNext = () => setSpotIdx((i) => (i + 1) % SPOTLIGHT_IMAGES.length);

  // Spotlight behavior: fade header only while spotlight overlaps header zone; drift overlay bar slightly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 960px)').matches) return;

    const spotlight = document.getElementById('project-spotlight');
    if (!spotlight) return;

    let headerH = 0;
    const readHeaderH = () => {
      try {
        const rs = getComputedStyle(document.documentElement);
        const h1 = parseFloat(rs.getPropertyValue('--headerH') || '0');
        const h2 = parseFloat(rs.getPropertyValue('--navH') || '0');
        headerH = isNaN(h1) ? (isNaN(h2) ? 0 : h2) : h1;
        if (!isFinite(headerH)) headerH = 0;
      } catch { headerH = 0; }
    };
    readHeaderH();

    const clamp = (v:number, a:number, b:number)=> Math.max(a, Math.min(b, v));

    const update = () => {
      const r = spotlight.getBoundingClientRect();
      const shouldHideHeader = r.top <= headerH && r.bottom > 0;
      document.body.classList.toggle('spotlight-on', shouldHideHeader);

      const vh = window.innerHeight || document.documentElement.clientHeight || 1;
      const p = clamp((vh * 0.5 - r.top) / Math.max(1, r.height), 0, 1);
      const dy = Math.round((p - 0.5) * 72);
      spotlight.style.setProperty('--barDY', `${dy}px`);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => { readHeaderH(); update(); }, { passive: true });

    return () => {
      document.body.classList.remove('spotlight-on');
      window.removeEventListener('scroll', update);
    };
  }, []);

  // Show the spotlight bar whenever the section is in view (>=15% visible)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 960px)').matches) return;

    const spotlight = document.getElementById('project-spotlight');
    if (!spotlight) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        spotlight.classList.toggle('is-active', e.isIntersecting && e.intersectionRatio > 0.15);
      });
    }, { threshold: [0, 0.15, 0.5, 1] });
    io.observe(spotlight);
    return () => { try { io.disconnect(); } catch {} };
  }, []);

  return (
    <>
      {/* Expanding image section above the process */}
      {/* Spacer above project highlight to isolate effects */}
      <section className="project-spacer project-spacer--top" aria-hidden="true" />

      <section className="project-spotlight" id="project-spotlight" aria-label="Project spotlight: Tamaki Drive">
        <div className="project-spotlight__container">
          <div className="project-spotlight__box">
            <Image
              key={SPOTLIGHT_IMAGES[spotIdx]}
              src={SPOTLIGHT_IMAGES[spotIdx]}
              alt={`Tamaki Drive project image ${spotIdx + 1}`}
              fill
              sizes="100vw"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="spotlight-bar" role="region" aria-label="Project spotlight controls">
            <button type="button" className="spotlight-bar__btn" aria-label="Previous image" onClick={spotPrev}>‹</button>
            <div className="spotlight-bar__sep" aria-hidden></div>
            <div className="spotlight-bar__title">Project Spotlight: Tamaki Dr</div>
            <div className="spotlight-bar__sep" aria-hidden></div>
            <button type="button" className="spotlight-bar__btn" aria-label="Next image" onClick={spotNext}>›</button>
          </div>
        </div>
      </section>

      {/* Spacer below project highlight to isolate effects */}
      <section className="project-spacer project-spacer--bottom" aria-hidden="true" />
    </>
  );
}

