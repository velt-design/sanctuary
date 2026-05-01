'use client';

import { useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import SpReveal from '@/components/SpReveal';
import RoofComparisonSection from '@/components/explore/RoofComparisonSection';
import RoofStudiesSection from '@/components/explore/RoofStudiesSection';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import HomeProjectsSection, { type HomeProjectCard } from '@/components/home/HomeProjectsSection';
import TimberSection from '@/components/home/TimberSection';
import AcrylicSection from '@/components/home/AcrylicSection';
import HomeProcessSection, { HomeProcessCtaBar } from '@/components/home/HomeProcessSection';
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

const MATERIALS_COPY_STYLE: CSSProperties = {
  width: 'min(88vw, 1288px)',
  marginInline: 'auto',
};

export default function HomePageClient({
  featureItems,
  processSteps,
  copyTexts,
  blurDataUrl,
  featuredProjects,
}: HomePageContent) {
  useEffect(() => {
    document.body.classList.add('homepage');

    const getScrollTop = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const setAtTopClass = () => {
      document.body.classList.toggle('home-at-top', getScrollTop() <= 0);
    };

    setAtTopClass();
    window.addEventListener('scroll', setAtTopClass, { passive: true });
    document.body.addEventListener('scroll', setAtTopClass, { passive: true });

    try {
      if (window.matchMedia('(min-width: 961px)').matches) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        });
      }
    } catch {}

    return () => {
      document.body.classList.remove('homepage');
      document.body.classList.remove('home-at-top');
      window.removeEventListener('scroll', setAtTopClass);
      document.body.removeEventListener('scroll', setAtTopClass);
    };
  }, []);

  return (
    <div className="homepage">
      <main>
        <HomeHeroSection blurDataUrl={blurDataUrl} />

        <section className="home-proof" aria-label="Sanctuary proof points">
          <div className="container home-proof__inner">
            {featureItems.map((item) => (
              <div className="home-proof__item" key={item.label} title={item.bubble}>
                {item.label}
              </div>
            ))}
          </div>
        </section>

        <HomeProjectsSection
          projects={featuredProjects}
          seeMoreHref="/projects"
          seeMoreLabel="View all projects"
          className="home-projects"
        />

        <RoofStudiesSection />

        <section className="bg-page py-[clamp(28px,6vh,88px)]">
          <div style={MATERIALS_COPY_STYLE}>
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Materials</p>
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

        <RoofComparisonSection />

        <section aria-label="Quick estimate" className="bg-page home-mid-cta">
          <div className="mx-auto flex min-h-[92px] w-[min(88vw,1288px)] items-center justify-center py-5">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center bg-[var(--accentRed)] px-6 py-2.5 text-center text-[18px] font-medium uppercase tracking-[0.08em] !text-white no-underline visited:!text-white hover:!text-white transition-colors hover:bg-[color-mix(in_srgb,var(--accentRed)_85%,#000_15%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accentRed)]/35"
            >
              Quick Estimate
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="materials-compare-heading"
          className="bg-page py-[clamp(48px,7vh,96px)]"
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

        <SpReveal
          id="sp-reveal-1"
          sentence="Every |angle |resolved. Comfort in any weather. Beautiful from every view. Designed for the {way you live.}| Built for light, life, and leisure. Sanctuary |Pergolas."
          images={['/images/project-dairy-flat-01.jpg', '/images/project-waiheke-02.jpg', '/images/product-pitched-06.jpg']}
          imageAlt="Project images"
          style={
            {
              '--sp-gutter': 'clamp(16px, 2.8vw, 40px)',
              '--sp-fit-nudge': '2px',
              '--sp-top-nudge': '-6px',
            } as CSSProperties
          }
        />

        <HomeProductsSection blurDataUrl={blurDataUrl} />

        <HomeWarrantySupportSection />

        <HomeProcessCtaBar />
      </main>
    </div>
  );
}
