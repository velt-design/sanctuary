import Image from 'next/image';
import { type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import { OverlayCtaButton } from '@/components/ui/OverlayCta';

type HeroSectionProps = {
  blurDataUrl: string;
  showIntroContact: boolean;
  introContactIn: boolean;
  titleIn: boolean;
  contactIn: boolean;
  revealImages: boolean;
  showProgress: boolean;
  progress: number;
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
  titleRef,
  contactRef,
}: HeroSectionProps) {
  const router = useRouter();

  return (
    <section className="container hero" id="top">
      {showIntroContact && (
        <div className={`intro-contact ${introContactIn ? 'show' : ''}`} aria-hidden="true">
          <div>
            <div className="label">Phone</div>
            <div>+64 9 634 9482</div>
          </div>
          <div>
            <div className="label">Email</div>
            <div>info@sanctuarypergolas.co.nz</div>
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
          <div className={`hero-card ${revealImages ? 'reveal' : ''}`}>
            <div className="wipe-inner">
              <Image
                src="/images/dairy-flat-hero.jpg"
                alt="Dairy Flat pergola at a modern home"
                fill
                sizes="(max-width: 960px) 100vw, 50vw"
                quality={75}
                style={{ objectFit: 'cover' }}
                placeholder="blur"
                blurDataURL={blurDataUrl}
              />
              <OverlayCtaButton
                onClick={() => router.push('/projects')}
                className="bottom-5 right-5 z-40 md:bottom-8 md:right-8"
              >
                Our Projects
              </OverlayCtaButton>
            </div>
            {showProgress && <div className="intro-progress">{progress}%</div>}
          </div>
        </div>
        <div className={`hero-right ${revealImages ? 'reveal' : ''}`}>
          <div className="wipe-inner">
            <Image
              src="/images/project-warkworth-03.jpg"
              alt="Architectural pergola at the Warkworth project"
              className="hero-right-image hero-right-image--top-desktop"
              fill
              priority
              fetchPriority="high"
              quality={75}
              placeholder="blur"
              blurDataURL={blurDataUrl}
              sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover', objectPosition: '50% 0%' }}
            />
            <OverlayCtaButton
              onClick={() => router.push('/contact')}
              className="bottom-5 right-5 z-40 md:bottom-8 md:right-8"
            >
              Quick Estimate
            </OverlayCtaButton>
          </div>
        </div>
      </div>
    </section>
  );
}
