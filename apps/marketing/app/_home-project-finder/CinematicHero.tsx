'use client';

import { getImageProps } from 'next/image';
import Link from 'next/link';
import {
  type CSSProperties,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Container } from '../../components/marketing-foundation/Primitives';
import type { ProjectFinderHomepageMedia } from './projectFinderMedia';
import styles from './projectFinderHomepage.module.css';

type CinematicHeroProps = {
  media: ProjectFinderHomepageMedia['hero'];
};

type HeroStage = 'image' | 'story';
type WelcomePhase = 'visible' | 'leaving' | 'hidden';

const WELCOME_MINIMUM_MS = 450;
const WELCOME_TIMEOUT_MS = 1_400;
const WELCOME_FADE_MS = 420;
const STORY_AUTO_REVEAL_DESKTOP_DELAY_MS = 400;
const STORY_AUTO_REVEAL_MOBILE_DELAY_MS = 500;
const MOBILE_HERO_MEDIA_QUERY = '(max-width: 900px)';
const WHEEL_GESTURE_RESET_MS = 180;
const TOUCH_SWIPE_THRESHOLD_PX = 36;
const FINDER_VIEWPORT_GAP_PX = 8;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

function ChevronMarker() {
  return (
    <svg
      aria-hidden="true"
      data-homepage-hero-symbol="chevron"
      viewBox="0 0 56 32"
    >
      <path d="m5 6 23 21L51 6" />
    </svg>
  );
}

export default function CinematicHero({ media }: CinematicHeroProps) {
  const [heroDecoded, setHeroDecoded] = useState(false);
  const [heroStage, setHeroStage] = useState<HeroStage>('image');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [storyCommitted, setStoryCommitted] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<WelcomePhase>('visible');
  const journeyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const imageArrowRef = useRef<HTMLButtonElement>(null);
  const storyArrowRef = useRef<HTMLButtonElement>(null);
  const heroStageRef = useRef<HeroStage>('image');
  const storyCommittedRef = useRef(false);
  const touchGestureHandledRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const welcomeStartedAtRef = useRef(0);
  const wheelGestureHandledRef = useRef(false);
  const wheelGestureTimerRef = useRef(0);

  const mobileHero = getImageProps({
    alt: media.alt,
    fetchPriority: 'high',
    fill: true,
    loading: 'eager',
    sizes: '100vw',
    src: media.mobileSrc ?? media.src,
  });
  const desktopHero = getImageProps({
    alt: media.alt,
    fetchPriority: 'high',
    fill: true,
    loading: 'eager',
    sizes: '100vw',
    src: media.src,
  });

  useEffect(() => {
    welcomeStartedAtRef.current = performance.now();
    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    const syncMotionPreference = () => setReducedMotion(motionPreference.matches);
    syncMotionPreference();
    motionPreference.addEventListener('change', syncMotionPreference);

    const timeout = window.setTimeout(
      () => setHeroDecoded(true),
      WELCOME_TIMEOUT_MS,
    );
    return () => {
      window.clearTimeout(timeout);
      motionPreference.removeEventListener('change', syncMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!heroDecoded) return undefined;

    const elapsed = performance.now() - welcomeStartedAtRef.current;
    const minimum = reducedMotion ? 0 : WELCOME_MINIMUM_MS;
    let hideTimer = 0;
    const leaveTimer = window.setTimeout(() => {
      setWelcomePhase(reducedMotion ? 'hidden' : 'leaving');
      if (!reducedMotion) {
        hideTimer = window.setTimeout(
          () => setWelcomePhase('hidden'),
          WELCOME_FADE_MS,
        );
      }
    }, Math.max(0, minimum - elapsed));

    return () => {
      window.clearTimeout(leaveTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [heroDecoded, reducedMotion]);

  const revealStoryCopy = useCallback(() => {
    if (storyCommittedRef.current) return;
    storyCommittedRef.current = true;
    heroStageRef.current = 'story';
    setStoryCommitted(true);
    setHeroStage('story');
  }, []);

  useEffect(() => {
    if (
      !heroDecoded
      || welcomePhase !== 'hidden'
      || storyCommitted
    ) return undefined;

    let delayElapsed = reducedMotion;
    let revealTimer = 0;
    let bodyObserver: MutationObserver | null = null;

    const stopWaiting = () => {
      if (revealTimer) window.clearTimeout(revealTimer);
      bodyObserver?.disconnect();
      document.removeEventListener('visibilitychange', revealIfReady);
    };
    const revealIfReady = () => {
      if (
        !delayElapsed
        || document.visibilityState !== 'visible'
        || document.body.classList.contains('mobile-menu-open')
      ) return;
      revealStoryCopy();
      stopWaiting();
    };

    document.addEventListener('visibilitychange', revealIfReady);
    bodyObserver = new MutationObserver(revealIfReady);
    bodyObserver.observe(document.body, {
      attributeFilter: ['class'],
      attributes: true,
    });

    if (reducedMotion) {
      revealIfReady();
    } else {
      const revealDelay = window.matchMedia(MOBILE_HERO_MEDIA_QUERY).matches
        ? STORY_AUTO_REVEAL_MOBILE_DELAY_MS
        : STORY_AUTO_REVEAL_DESKTOP_DELAY_MS;
      revealTimer = window.setTimeout(() => {
        delayElapsed = true;
        revealIfReady();
      }, revealDelay);
    }

    return stopWaiting;
  }, [
    heroDecoded,
    reducedMotion,
    revealStoryCopy,
    storyCommitted,
    welcomePhase,
  ]);

  const syncHeroStage = useCallback(() => {
    const journey = journeyRef.current;
    if (!journey) return;
    const revealedDistance = Math.max(0, -journey.getBoundingClientRect().top);
    const revealThreshold = Math.min(window.innerHeight * .26, 280);
    const nextStage = storyCommittedRef.current
      || revealedDistance >= revealThreshold
      ? 'story'
      : 'image';
    heroStageRef.current = nextStage;
    setHeroStage(nextStage);
  }, []);

  useEffect(() => {
    let rafId = 0;
    const scheduleStageSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncHeroStage();
      });
    };

    syncHeroStage();
    window.addEventListener('scroll', scheduleStageSync, { passive: true });
    window.addEventListener('resize', scheduleStageSync);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleStageSync);
      window.removeEventListener('resize', scheduleStageSync);
    };
  }, [syncHeroStage]);

  useEffect(() => {
    const activeElement = document.activeElement;
    if (heroStage === 'story' && activeElement === imageArrowRef.current) {
      const focusDelay = reducedMotion ? 0 : WELCOME_FADE_MS;
      const focusTimer = window.setTimeout(() => {
        headingRef.current?.focus({ preventScroll: true });
      }, focusDelay);
      return () => window.clearTimeout(focusTimer);
    } else if (heroStage === 'image' && activeElement === storyArrowRef.current) {
      imageArrowRef.current?.focus({ preventScroll: true });
    }
    return undefined;
  }, [heroStage, reducedMotion]);

  const handleHeroImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    void image.decode()
      .catch(() => undefined)
      .finally(() => setHeroDecoded(true));
  };

  const revealStory = useCallback(() => {
    const journey = journeyRef.current;
    if (!journey) return;
    revealStoryCopy();
    const journeyTop = window.scrollY + journey.getBoundingClientRect().top;
    window.scrollTo({
      behavior: scrollBehavior(),
      top: journeyTop + Math.min(window.innerHeight * .68, 620),
    });
  }, [revealStoryCopy]);

  const continueToFinder = useCallback(() => {
    const opening = document.getElementById('project-finder-opening');
    if (!opening) return;
    const openingRect = opening.getBoundingClientRect();
    const visualViewportTop = window.visualViewport?.offsetTop ?? 0;
    const visualViewportHeight = window.visualViewport?.height
      ?? window.innerHeight;
    const visualViewportBottom = visualViewportTop + visualViewportHeight;
    const headerBottom = Math.max(
      visualViewportTop,
      document.querySelector<HTMLElement>('header.site')
        ?.getBoundingClientRect().bottom ?? visualViewportTop,
    );
    const availableTop = headerBottom + FINDER_VIEWPORT_GAP_PX;
    const availableBottom = visualViewportBottom - FINDER_VIEWPORT_GAP_PX;
    const availableHeight = Math.max(0, availableBottom - availableTop);
    const desiredTop = openingRect.height <= availableHeight
      ? availableTop + ((availableHeight - openingRect.height) / 2)
      : availableTop;

    window.scrollTo({
      behavior: scrollBehavior(),
      top: Math.max(0, window.scrollY + openingRect.top - desiredTop),
    });
  }, []);

  const advanceHeroJourney = useCallback(() => {
    if (heroStageRef.current === 'image') {
      heroStageRef.current = 'story';
      revealStory();
      return;
    }
    continueToFinder();
  }, [continueToFinder, revealStory]);

  useEffect(() => {
    if (welcomePhase !== 'hidden') return undefined;

    const journeyIsActive = () => {
      const journey = journeyRef.current;
      const finder = document.getElementById('project-finder');
      if (!journey || !finder) return false;
      const journeyRect = journey.getBoundingClientRect();
      const finderTop = window.scrollY + finder.getBoundingClientRect().top;
      return journeyRect.top <= 1
        && journeyRect.bottom > 1
        && window.scrollY < finderTop - 1;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY <= 0 || !journeyIsActive()) return;
      event.preventDefault();
      window.clearTimeout(wheelGestureTimerRef.current);
      wheelGestureTimerRef.current = window.setTimeout(() => {
        wheelGestureHandledRef.current = false;
      }, WHEEL_GESTURE_RESET_MS);
      if (wheelGestureHandledRef.current) return;
      wheelGestureHandledRef.current = true;
      advanceHeroJourney();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      touchGestureHandledRef.current = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const startY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY === null || currentY === undefined || !journeyIsActive()) return;
      const forwardDistance = startY - currentY;
      if (forwardDistance <= 0) return;

      // Cancel native panning from the first forward movement. Waiting until
      // the swipe threshold lets mobile Safari begin a momentum scroll that
      // can carry the same gesture through both hero stages.
      if (event.cancelable) event.preventDefault();
      if (forwardDistance < TOUCH_SWIPE_THRESHOLD_PX) return;
      if (touchGestureHandledRef.current) return;
      touchGestureHandledRef.current = true;
      advanceHeroJourney();
    };

    const resetTouchGesture = () => {
      touchStartYRef.current = null;
      touchGestureHandledRef.current = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || !['ArrowDown', 'PageDown', ' '].includes(event.key)
        || target?.closest('a, button, input, select, textarea, [contenteditable="true"]')
        || !journeyIsActive()
      ) return;
      event.preventDefault();
      advanceHeroJourney();
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', resetTouchGesture, { passive: true });
    window.addEventListener('touchcancel', resetTouchGesture, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(wheelGestureTimerRef.current);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', resetTouchGesture);
      window.removeEventListener('touchcancel', resetTouchGesture);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [advanceHeroJourney, welcomePhase]);

  return (
    <>
      {welcomePhase !== 'hidden' ? (
        <div
          aria-hidden="true"
          className={styles.welcome}
          data-homepage-welcome
          data-welcome-phase={welcomePhase}
        >
          <div className={styles.welcomeInner}>
            <p className={styles.welcomeTitle}>
              <span>Welcome to</span>
              <strong>Sanctuary Pergolas</strong>
            </p>
          </div>
        </div>
      ) : null}

      <div
        ref={journeyRef}
        className={styles.heroJourney}
        data-homepage-hero-journey
        data-hero-stage={heroStage}
      >
        <section
          className={styles.hero}
          aria-labelledby="project-finder-home-heading"
          data-homepage-hero
          data-homepage-hero-sticky
        >
          <div className={styles.heroMedia}>
            <picture>
              <source
                media="(max-width: 760px)"
                srcSet={mobileHero.props.srcSet}
              />
              {/* Art-directed priority image: Next provides optimized source sets. */}
              <img
                {...desktopHero.props}
                className={styles.heroImage}
                onLoad={handleHeroImageLoad}
                style={{
                  ...desktopHero.props.style,
                  '--hero-mobile-object-position': media.mobileObjectPosition,
                  '--hero-object-position': media.objectPosition,
                } as CSSProperties}
              />
            </picture>
          </div>
          <div
            className={styles.heroShade}
            aria-hidden="true"
            data-homepage-hero-shade
          />
          <Container
            className={styles.heroContent}
            data-homepage-story
            width="wide"
          >
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>
                Fixed-roof pergola design and build in Auckland
              </p>
              <h1
                ref={headingRef}
                id="project-finder-home-heading"
                tabIndex={-1}
              >
                Outdoor spaces designed around the way you live.
              </h1>
              <p className={styles.heroSupport}>
                Custom pergolas and outdoor rooms, designed around the house,
                the site and how the space will be used.
              </p>
            </div>
            <p className={styles.heroProjectMeta}>
              <span>Completed project</span>
              <Link href={`/projects/${media.projectSlug}`}>
                {media.projectTitle}, {media.location}
              </Link>
            </p>
          </Container>

          <button
            ref={imageArrowRef}
            type="button"
            aria-hidden={heroStage !== 'image'}
            aria-label="Reveal the Sanctuary introduction"
            className={`${styles.heroArrow} ${styles.heroArrowImage}`}
            data-homepage-hero-arrow="reveal"
            onClick={revealStory}
            tabIndex={heroStage === 'image' ? 0 : -1}
          >
            <ChevronMarker />
          </button>
          <button
            ref={storyArrowRef}
            type="button"
            aria-hidden={heroStage !== 'story'}
            aria-label="Continue to choose your project starting point"
            className={`${styles.heroArrow} ${styles.heroArrowStory}`}
            data-homepage-hero-arrow="continue"
            data-project-finder-event="project_finder_start_click"
            data-source-component="hero"
            data-step-number="1"
            onClick={continueToFinder}
            tabIndex={heroStage === 'story' ? 0 : -1}
          >
            <ChevronMarker />
          </button>
        </section>
      </div>

      <noscript>
        <style>{`
          [data-homepage-welcome] { display: none !important; }
          [data-homepage-hero-journey] { height: auto !important; }
          [data-homepage-hero-sticky] { position: relative !important; }
          [data-homepage-hero-shade], [data-homepage-story] {
            opacity: 1 !important;
            transform: none !important;
            visibility: visible !important;
          }
          [data-homepage-hero-arrow] { display: none !important; }
          header.site {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }
        `}</style>
      </noscript>
    </>
  );
}
