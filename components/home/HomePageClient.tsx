'use client';

import { useEffect, useRef, useState } from 'react';
import SpReveal from '@/components/SpReveal';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import TimberSection from '@/components/home/TimberSection';
import AcrylicSection from '@/components/home/AcrylicSection';
import HomeProcessSection from '@/components/home/HomeProcessSection';
import ProjectSpotlightSection from '@/components/home/ProjectSpotlightSection';
import HomeGallerySection from '@/components/home/HomeGallerySection';
import HomeFeatureBar from '@/components/home/HomeFeatureBar';
import HomeProductsSection from '@/components/home/HomeProductsSection';

export type ProcessStep = { title: string; desc: string };

export type HomePageContent = {
  featureItems: string[];
  processSteps: ProcessStep[];
  copyTexts: string[];
  blurDataUrl: string;
};

export default function HomePageClient({
  featureItems,
  processSteps,
  copyTexts,
  blurDataUrl,
}: HomePageContent) {
  // Intro transition state (homepage only)
  const [showIntroContact, setShowIntroContact] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [revealImages, setRevealImages] = useState(false);
  const [introContactIn, setIntroContactIn] = useState(false);
  const [titleIn, setTitleIn] = useState(false);
  const [contactIn, setContactIn] = useState(false);
  // Track load state for pitched product image so we can animate it in after other content is ready
  const [pitchedLoaded, setPitchedLoaded] = useState(false);
  // Mobile hero load state (product-pitched-01)
  const [mobileHeroLoaded, setMobileHeroLoaded] = useState(false);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const contactRef = useRef<HTMLDivElement | null>(null);
  // Gate other scroll effects while highlight/process are active
  const scrollGateRef = useRef(false);
  useEffect(() => {
    document.body.classList.add('homepage');
    // Track whether the page is scrolled to the very top to control the header bottom rule
    const setAtTopClass = () => {
      const atTop = (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
      document.body.classList.toggle('home-at-top', atTop);
    };
    setAtTopClass();
    window.addEventListener('scroll', setAtTopClass, { passive: true });
    // Ensure we start exactly at top on desktop to avoid visual offset
    try {
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches) {
        requestAnimationFrame(() => {
          // Run after layout
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          // Fallbacks for some browsers
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
      }
    } catch {}
    return () => {
      document.body.classList.remove('homepage');
      document.body.classList.remove('home-at-top');
      window.removeEventListener('scroll', setAtTopClass);
    };
  }, []);

  useEffect(() => {
    const zone = document.getElementById('feature-zone');
    const bar = document.getElementById('feature-bar');
    const hero = document.querySelector('.hero');
    const products = document.getElementById('products');
    if (!zone || !bar || !hero || !products) return;

    const sizeZone = () => {
      const cs = getComputedStyle(bar);
      // If the bar is hidden (mobile), collapse the zone height to 0 to disable the effect cleanly
      if (cs.display === 'none' || bar.offsetHeight === 0) {
        zone.style.height = '0px';
        return;
      }
      const h = bar.offsetHeight;
      bar.style.setProperty('--barH', `${h}px`);
      const rs = getComputedStyle(document.documentElement);
      const mult = parseFloat(rs.getPropertyValue('--slowMult')) || 10;
      zone.style.height = `${h * mult}px`;
    };

    const apply = (p: number) => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const off = vh * 1.1;
      hero.setAttribute('style', `transform:translate3d(0, ${-(p * off)}px, 0)`);
      products.setAttribute('style', `transform:translate3d(0, ${p * off}px, 0)`);
    };

    let progress = 0;
    let lastZoneCenterY: number | null = null;
    let ticking = false;

    const compute = () => {
      if (scrollGateRef.current) return; // pause when highlight/process are active
      const zoneRect = zone.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const center = zoneRect.top + zoneRect.height / 2;
      const lower = vh / 3;
      const upper = (2 * vh) / 3;
      const mid = (lower + upper) / 2;
      const half = (upper - lower) / 2;

      let target = 0;
      const d = Math.abs(center - mid);
      if (d < half) target = 1 - d / half;

      let delta = 0;
      if (lastZoneCenterY !== null) delta = Math.abs(center - lastZoneCenterY);
      lastZoneCenterY = center;

      const step = delta / Math.max(1, zoneRect.height);
      if (progress < target) progress = Math.min(target, progress + step);
      else if (progress > target) progress = Math.max(target, progress - step);

      apply(progress);
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          compute();
          ticking = false;
        });
        ticking = true;
      }
    };

    sizeZone();
    // Only compute/apply transforms if the zone is active (not hidden)
    if (zone.clientHeight > 0) {
      compute();
    }

    window.addEventListener('resize', sizeZone);
    if (zone.clientHeight > 0) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    }

    return () => {
      window.removeEventListener('resize', sizeZone);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Run the requested homepage intro sequence on mount
  useEffect(() => {

    // 1) Contact info slides up and settles one gutter from bottom (0.5s)
    setShowIntroContact(true);
    // Trigger CSS transition on next frame
    requestAnimationFrame(() => setIntroContactIn(true));
    // H1/hero contact fade-in handled by IntersectionObserver below
    const contactTimer = window.setTimeout(() => {
      setIntroContactIn(false);
      setShowIntroContact(false);

      // 2) Progress counter 0% -> 100%
      setShowProgress(true);
      const duration = 1100; // ms
      const start = performance.now();
      const tick = (now: number) => {
        const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
        setProgress(pct);
        if (pct < 100) requestAnimationFrame(tick);
        else {
          setShowProgress(false);
          // 3) Wipe reveal from bottom to top
          setRevealImages(true);
        }
      };
      requestAnimationFrame(tick);
    }, 500);

    return () => {
      window.clearTimeout(contactTimer);
    };
  }, []);

  // Fade-in when elements enter the viewport
  useEffect(() => {
    const titleEl = titleRef.current;
    const contactEl = contactRef.current;
    if (!titleEl && !contactEl) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === titleEl) setTitleIn(true);
            if (entry.target === contactEl) setContactIn(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (titleEl) io.observe(titleEl);
    if (contactEl) io.observe(contactEl);

    return () => io.disconnect();
  }, []);

  return (
    <div className="homepage">
      <main>
        <HomeHeroSection
          blurDataUrl={blurDataUrl}
          showIntroContact={showIntroContact}
          introContactIn={introContactIn}
          titleIn={titleIn}
          contactIn={contactIn}
          revealImages={revealImages}
          showProgress={showProgress}
          progress={progress}
          mobileHeroLoaded={mobileHeroLoaded}
          setMobileHeroLoaded={setMobileHeroLoaded}
          titleRef={titleRef}
          contactRef={contactRef}
        />

        <div id="gallery" aria-hidden="true" />

        <HomeFeatureBar featureItems={featureItems} />
        <HomeProductsSection
          blurDataUrl={blurDataUrl}
          revealImages={revealImages}
          pitchedLoaded={pitchedLoaded}
          setPitchedLoaded={setPitchedLoaded}
        />

        {/* Word-by-word statement section (after product tiles) */}
        <SpReveal
          id="sp-reveal-1"
          sentence="Every |angle |resolved. Comfort in any weather. Beautiful from every view. Designed for the {way you live.}| Built for light, life, and leisure. Sanctuary |Pergolas."
          images={["/images/project-dairy-flat-01.jpg", "/images/project-waiheke-02.jpg", "/images/product-pitched-06.jpg"]}
          imageAlt="Project images"
          style={
            {
              '--sp-gutter': 'clamp(16px, 2.8vw, 40px)',
              '--sp-fit-nudge': '2px',
              '--sp-top-nudge': '-6px',
            } as React.CSSProperties
          }
        />

        <TimberSection />
        <AcrylicSection />

        <ProjectSpotlightSection />
        <HomeGallerySection />
        <HomeProcessSection processSteps={processSteps} copyTexts={copyTexts} />

        {/* Removed in-page CTA to use global full-height footer instead */}
      </main>
    </div>
  );
}
