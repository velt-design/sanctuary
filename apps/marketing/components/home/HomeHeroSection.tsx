import Image from 'next/image';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
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
  const router = useRouter();
  const leftVideoRef = useRef<HTMLVideoElement | null>(null);
  const [canHoverLeftVideo, setCanHoverLeftVideo] = useState(false);
  const [shouldLoadLeftVideo, setShouldLoadLeftVideo] = useState(false);
  const [isLeftVideoHovering, setIsLeftVideoHovering] = useState(false);
  const [isLeftVideoReady, setIsLeftVideoReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncHoverCapability = () => setCanHoverLeftVideo(mediaQuery.matches);

    syncHoverCapability();
    mediaQuery.addEventListener?.('change', syncHoverCapability);
    mediaQuery.addListener?.(syncHoverCapability);

    return () => {
      mediaQuery.removeEventListener?.('change', syncHoverCapability);
      mediaQuery.removeListener?.(syncHoverCapability);
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadLeftVideo) return;
    const videoEl = leftVideoRef.current;
    if (!videoEl) return;

    if (isLeftVideoHovering) {
      const playVideo = () => {
        void videoEl.play().catch(() => {});
      };

      if (videoEl.readyState >= 2) {
        playVideo();
        return;
      }

      const handleCanPlay = () => playVideo();
      videoEl.addEventListener('canplay', handleCanPlay, { once: true });
      return () => videoEl.removeEventListener('canplay', handleCanPlay);
    }

    videoEl.pause();
    videoEl.currentTime = 0;
  }, [isLeftVideoHovering, shouldLoadLeftVideo]);

  const handleLeftMediaEnter = () => {
    if (!canHoverLeftVideo) return;
    setShouldLoadLeftVideo(true);
    setIsLeftVideoHovering(true);
  };

  const handleLeftMediaLeave = () => {
    setIsLeftVideoHovering(false);
  };

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
                sizes="100vw"
                style={{ objectFit: 'cover' }}
                placeholder="blur"
                blurDataURL={blurDataUrl}
                onLoadingComplete={() => setMobileHeroLoaded(true)}
              />
            </div>
          </div>
          <div
            className={`hero-card ${revealImages ? 'reveal' : ''}`}
            onMouseEnter={handleLeftMediaEnter}
            onMouseLeave={handleLeftMediaLeave}
          >
            <div className="wipe-inner">
              <Image
                src="/images/gable-rainforest.jpg"
                alt="Gable pergola in a rainforest setting"
                fill
                sizes="(max-width: 960px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
                placeholder="blur"
                blurDataURL={blurDataUrl}
                className={isLeftVideoHovering && isLeftVideoReady ? 'opacity-0 transition-opacity duration-300' : 'opacity-100 transition-opacity duration-300'}
              />
              {shouldLoadLeftVideo ? (
                <video
                  ref={leftVideoRef}
                  loop
                  muted
                  playsInline
                  preload="none"
                  aria-label="Gable sanctuary pergola loop video"
                  onLoadedData={() => setIsLeftVideoReady(true)}
                  onCanPlay={() => setIsLeftVideoReady(true)}
                  className={isLeftVideoHovering && isLeftVideoReady ? 'pointer-events-none absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-300' : 'pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300'}
                >
                  <source src="/videos/gable-sanctuary-loop.mp4" type="video/mp4" />
                </video>
              ) : null}
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
              src="/images/dairy-flat-hero.jpg"
              alt="Dairy Flat pergola at a modern home"
              fill
              priority
              placeholder="blur"
              blurDataURL={blurDataUrl}
              sizes="(max-width: 960px) 100vw, 50vw"
              style={{ objectFit: 'cover' }}
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
