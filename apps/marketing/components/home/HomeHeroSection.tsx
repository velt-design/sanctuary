import Image from 'next/image';
import Link from 'next/link';
import type { MutableRefObject } from 'react';

type HeroSectionProps = {
  blurDataUrl: string;
  showIntroContact: boolean;
  introContactIn: boolean;
  titleIn: boolean;
  contactIn: boolean;
  revealImages: boolean;
  showProgress: boolean;
  progress: number;
  mobileHeroLoaded: boolean;
  setMobileHeroLoaded: (loaded: boolean) => void;
  titleRef: MutableRefObject<HTMLHeadingElement | null>;
  contactRef: MutableRefObject<HTMLDivElement | null>;
};

export default function HomeHeroSection({
  blurDataUrl,
  showIntroContact,
  introContactIn,
  titleIn,
  contactIn,
  revealImages,
  showProgress,
  progress,
  mobileHeroLoaded,
  setMobileHeroLoaded,
  titleRef,
  contactRef,
}: HeroSectionProps) {
  return (
    <section className="container hero" id="top">
      {showIntroContact && (
        <div className={`intro-contact ${introContactIn ? 'show' : ''}`} aria-hidden="true">
          <div>
            <div className="label">Phone</div>
            <a href="tel:+6496349482">+64 9 634 9482</a>
          </div>
          <div>
            <div className="label">Email</div>
            <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>
          </div>
        </div>
      )}
      <div className="split">
        <div className="hero-left-grid">
          <div className="hero-top">
            <div className="hero-info">
              <h1 ref={titleRef} className={`hero-title ${titleIn ? 'in' : ''}`}>
                Architectural pergolas<br />
                <span className="muted-line">tailored to kiwi homes.</span>
              </h1>
            </div>
            <div ref={contactRef} className={`hero-contact ${contactIn ? 'in' : ''}`}>
              <div>
                <div className="label">Phone</div>
                <a href="tel:+6496349482">+64 9 634 9482</a>
              </div>
              <div>
                <div className="label">Email</div>
                <a href="mailto:info@sanctuarypergolas.co.nz">info@sanctuarypergolas.co.nz</a>
              </div>
            </div>
          </div>
          <div className={`mobile-hero ${mobileHeroLoaded && revealImages ? 'reveal' : ''}`}>
            <div className="wipe-inner">
              <Image
                src="/images/product-pitched-01.jpg"
                alt="Pitched pergola hero"
                fill
                priority
                sizes="100vw"
                style={{ objectFit: 'cover' }}
                placeholder="blur"
                blurDataURL={blurDataUrl}
                onLoadingComplete={() => setMobileHeroLoaded(true)}
              />
            </div>
          </div>
          <div className={`hero-card ${revealImages ? 'reveal' : ''}`}>
            <div className="wipe-inner">
              <Image
                src="/images/hero-1.jpg"
                alt="Custom aluminium pergola at a modern home"
                width={800}
                height={600}
                priority
                placeholder="blur"
                blurDataURL={blurDataUrl}
                sizes="(max-width: 960px) 100vw, 50vw"
              />
              <Link href="/projects" className="image-cta">Our Projects</Link>
            </div>
            {showProgress && <div className="intro-progress">{progress}%</div>}
          </div>
        </div>
        <div className={`hero-right ${revealImages ? 'reveal' : ''}`}>
          <div className="wipe-inner">
            <Image
              src="/images/hero-2.jpg"
              alt="Aluminium pergola over outdoor seating area"
              width={800}
              height={600}
              priority
              placeholder="blur"
              blurDataURL={blurDataUrl}
              sizes="(max-width: 960px) 100vw, 50vw"
            />
            <Link href="/contact" className="image-cta">Quick Estimate</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
