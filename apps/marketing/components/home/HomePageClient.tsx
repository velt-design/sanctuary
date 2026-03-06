'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import SpReveal from '@/components/SpReveal';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import HomeProjectsSection, { type HomeProjectCard } from '@/components/home/HomeProjectsSection';
import TimberSection from '@/components/home/TimberSection';
import AcrylicSection from '@/components/home/AcrylicSection';
import HomeProcessSection, { HomeProcessCtaBar } from '@/components/home/HomeProcessSection';
import HomeFeatureBar from '@/components/home/HomeFeatureBar';
import HomeProductsSection from '@/components/home/HomeProductsSection';
import HomeWarrantySupportSection from '@/components/home/HomeWarrantySupportSection';

export type ProcessStep = { title: string; desc: string };

export type FeatureItem = { label: string; bubble: string };

export type HomePageContent = {
  featureItems: FeatureItem[];
  processSteps: ProcessStep[];
  copyTexts: string[];
  blurDataUrl: string;
  featuredProjects: HomeProjectCard[];
};

const MATERIALS_COPY_STYLE: React.CSSProperties = {
  width: 'min(88vw, 1288px)',
  marginInline: 'auto',
};

const LazyRoofComparisonSection = dynamic(() => import('@/components/explore/RoofComparisonSection'), {
  ssr: false,
  loading: () => <section className="bg-page py-[clamp(64px,10vh,128px)]" aria-hidden="true" />,
});

const LazyRoofStudiesSection = dynamic(() => import('@/components/explore/RoofStudiesSection'), {
  ssr: false,
  loading: () => <section className="bg-page py-[clamp(64px,10vh,128px)]" aria-hidden="true" />,
});

export default function HomePageClient({
  featureItems,
  processSteps,
  copyTexts,
  blurDataUrl,
  featuredProjects,
}: HomePageContent) {
  // Keep above-the-fold hero visible immediately for fast LCP.
  const showIntroContact = false;
  const showProgress = false;
  const progress = 0;
  const revealImages = true;
  const introContactIn = false;
  const titleIn = true;
  const contactIn = true;
  const [shouldLoadRoofStudies, setShouldLoadRoofStudies] = useState(false);
  const [shouldLoadRoofComparison, setShouldLoadRoofComparison] = useState(false);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const contactRef = useRef<HTMLDivElement | null>(null);
  const roofStudiesSentinelRef = useRef<HTMLDivElement | null>(null);
  const roofComparisonSentinelRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoadRoofStudies(true);
      setShouldLoadRoofComparison(true);
      return;
    }

    const observers: IntersectionObserver[] = [];

    const observe = (
      node: HTMLDivElement | null,
      setVisible: (visible: boolean) => void,
      rootMargin: string
    ) => {
      if (!node) {
        setVisible(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          setVisible(true);
          observer.disconnect();
        },
        { rootMargin }
      );
      observer.observe(node);
      observers.push(observer);
    };

    observe(roofStudiesSentinelRef.current, setShouldLoadRoofStudies, '320px 0px');
    observe(roofComparisonSentinelRef.current, setShouldLoadRoofComparison, '360px 0px');

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  return (
    <div className="homepage">
      <main>
        <div className="homepage-legacy-scope">
          <HomeHeroSection
            blurDataUrl={blurDataUrl}
            showIntroContact={showIntroContact}
            introContactIn={introContactIn}
            titleIn={titleIn}
            contactIn={contactIn}
            revealImages={revealImages}
            showProgress={showProgress}
            progress={progress}
            titleRef={titleRef}
            contactRef={contactRef}
          />

          <div id="gallery" aria-hidden="true" />

          <HomeFeatureBar featureItems={featureItems} />
        </div>

        <div ref={roofStudiesSentinelRef}>
          {shouldLoadRoofStudies ? (
            <LazyRoofStudiesSection />
          ) : (
            <section className="bg-page py-[clamp(64px,10vh,128px)]" aria-hidden="true" />
          )}
        </div>

        <section className="bg-page py-[clamp(36px,7vh,104px)]">
          <div style={MATERIALS_COPY_STYLE}>
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Materials.</p>
            <h2 className="mt-3 max-w-[24ch] text-balance text-[clamp(32px,4.4vw,62px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
              Bright and open, or cool and shaded - dial it in with materials.
            </h2>
            <p className="mt-6 max-w-[76ch] text-[17px] leading-[1.66] text-muted">
              Material choice sets the tone for the entire pergola - how light moves through it, how warm it feels, how much upkeep it asks for, and how it will age over time.{` `}
              <span className="text-ink">Acrylic keeps spaces bright and open. Timber adds warmth and texture. Combination systems balance both.</span>{` `}
              Aluminium stays crisp and architectural, with colour options that sit quietly alongside your exterior palette.
            </p>
          </div>
        </section>

        <div ref={roofComparisonSentinelRef}>
          {shouldLoadRoofComparison ? (
            <LazyRoofComparisonSection />
          ) : (
            <section className="bg-page py-[clamp(64px,10vh,128px)]" aria-hidden="true" />
          )}
        </div>

        <section aria-label="Book a design consultation" className="bg-page">
          <div className="mx-auto flex min-h-[120px] w-[min(88vw,1288px)] items-center justify-center py-6">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-[var(--accentRed)] px-6 py-2.5 text-center text-[18px] font-medium uppercase tracking-[0.08em] !text-white no-underline visited:!text-white hover:!text-white transition-colors hover:bg-[color-mix(in_srgb,var(--accentRed)_85%,#000_15%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accentRed)]/35"
            >
              Book a design consultation
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="materials-compare-heading"
          className="bg-page py-[clamp(56px,8vh,112px)]"
        >
          <div className="mx-auto w-[min(88vw,1288px)]">
            <p
              id="materials-compare-heading"
              className="text-[12px] uppercase tracking-[0.12em] text-muted"
            >
              Material comparison
            </p>
            <div className="mt-6 grid gap-6 md:mt-8 md:gap-10">
              <TimberSection />
              <AcrylicSection />
            </div>
          </div>
        </section>

        <div className="homepage-legacy-scope">

          <HomeProcessSection processSteps={processSteps} copyTexts={copyTexts} />
        </div>

        <HomeProjectsSection
          projects={featuredProjects}
          seeMoreHref="/projects"
          seeMoreLabel="See more projects"
        />

        <div className="homepage-legacy-scope">
          {/* Word-by-word statement section (text left + images right) */}
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

          <HomeProductsSection blurDataUrl={blurDataUrl} />

          <HomeWarrantySupportSection />

          <HomeProcessCtaBar />
        </div>

        {/* Contact red bar now appears above the global footer */}
      </main>
    </div>
  );
}
