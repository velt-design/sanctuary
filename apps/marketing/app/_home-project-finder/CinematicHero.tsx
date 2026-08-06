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

type WelcomePhase = 'visible' | 'leaving' | 'hidden';

const WELCOME_MINIMUM_MS = 450;
const WELCOME_TIMEOUT_MS = 1_400;
const WELCOME_FADE_MS = 420;
const STORY_AUTO_REVEAL_DESKTOP_DELAY_MS = 400;
const STORY_AUTO_REVEAL_MOBILE_DELAY_MS = 500;
const MOBILE_HERO_MEDIA_QUERY = '(max-width: 900px)';
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [storyVisible, setStoryVisible] = useState(false);
  const [welcomePhase, setWelcomePhase] = useState<WelcomePhase>('visible');
  const welcomeStartedAtRef = useRef(0);

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

  useEffect(() => {
    if (welcomePhase !== 'hidden' || storyVisible) return undefined;

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
      setStoryVisible(true);
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
  }, [reducedMotion, storyVisible, welcomePhase]);

  const handleHeroImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    void image.decode()
      .catch(() => undefined)
      .finally(() => setHeroDecoded(true));
  };

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

  return (
    <>
      {welcomePhase !== 'hidden' ? (
        <div
          aria-hidden="true"
          className={styles.welcome}
          data-homepage-welcome
          data-welcome-phase={welcomePhase}
        />
      ) : null}

      <div
        className={styles.heroJourney}
        data-homepage-hero-journey
        data-story-visible={storyVisible ? 'true' : 'false'}
      >
        <section
          className={styles.hero}
          aria-labelledby="project-finder-home-heading"
          data-homepage-hero
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
              <h1 id="project-finder-home-heading">
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
            type="button"
            aria-hidden={!storyVisible}
            aria-label="Continue to choose your project starting point"
            className={styles.heroArrow}
            data-homepage-hero-arrow="continue"
            data-project-finder-event="project_finder_start_click"
            data-source-component="hero"
            data-step-number="1"
            onClick={continueToFinder}
            tabIndex={storyVisible ? 0 : -1}
          >
            <ChevronMarker />
          </button>
        </section>
      </div>

      <noscript>
        <style>{`
          [data-homepage-welcome] { display: none !important; }
          [data-homepage-hero-journey] { height: auto !important; }
          [data-homepage-hero-shade], [data-homepage-story] {
            opacity: 1 !important;
            transform: none !important;
            visibility: visible !important;
          }
          [data-homepage-story] > * > *,
          [data-homepage-story] > p {
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
