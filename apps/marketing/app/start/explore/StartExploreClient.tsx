'use client';

import * as React from 'react';
import Image from 'next/image';
import { ButtonLink } from '@/components/ui/Button';
import Container from '@/components/ui/Container';
import { LineGlyphButton } from '@/components/ui/LineGlyphButton';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from './_foundation/usePrefersReducedMotion';

type MaterialId = 'acrylic' | 'timber' | 'combo' | 'aluminium';
type Mode = 'browse' | 'focus';
type AluminiumColorId = 'silver' | 'white' | 'black' | 'bronze';
type RoofTypeFitId = 'acrylic' | 'timber' | 'combo';

type ImageMediaSpec = {
  mediaType?: 'image';
  src: string;
  alt: string;
  fit: 'contain' | 'cover';
  position?: string;
};

type VideoMediaSpec = {
  mediaType: 'video';
  src: string;
  ariaLabel: string;
  playbackRate?: number;
};

type MediaSpec = ImageMediaSpec | VideoMediaSpec;

type MaterialConfig = {
  id: MaterialId;
  label: string;
  bubbleTitle: string;
  bubbleBody: string;
  media: { browse: MediaSpec; focus: MediaSpec };
  aluminiumColors?: Array<{
    id: AluminiumColorId;
    label: string;
    hex: string;
    media: { browse: MediaSpec; focus: MediaSpec };
  }>;
};

type HighlightCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  media: MediaSpec;
  materialId?: MaterialId;
  tone?: 'light' | 'dark';
};

type RoofTypeFitMeters = {
  daylight: 1 | 2 | 3 | 4 | 5;
  heatGlare: 1 | 2 | 3 | 4 | 5;
  rainNoise: 1 | 2 | 3 | 4 | 5;
};

const ROOF_TYPE_FIT_CONFIG: Record<RoofTypeFitId, { label: string; meters: RoofTypeFitMeters }> = {
  acrylic: {
    label: 'Acrylic',
    meters: { daylight: 5, heatGlare: 3, rainNoise: 2 },
  },
  timber: {
    label: 'Timber sarking',
    meters: { daylight: 2, heatGlare: 5, rainNoise: 5 },
  },
  combo: {
    label: 'Combination',
    meters: { daylight: 4, heatGlare: 4, rainNoise: 4 },
  },
};

const ROOF_TYPE_FIT_OPTIONS: RoofTypeFitId[] = ['acrylic', 'timber', 'combo'];

const ROOF_TYPE_FIT_ROWS: Array<{
  key: keyof RoofTypeFitMeters;
  label: string;
}> = [
  { key: 'daylight', label: 'Daylight' },
  { key: 'heatGlare', label: 'Heat & glare' },
  { key: 'rainNoise', label: 'Rain-noise dampening' },
];

const DEFAULT_VIDEO_PLAYBACK_RATE = 2;
const HIGHLIGHT_CARD_WIDTH = 'min(88vw, 1288px)';
const DESKTOP_HIGHLIGHTS_BREAKPOINT = '(min-width: 1024px)';
const COMPACT_HIGHLIGHT_GAP_PX = 24;
const HIGHLIGHT_TRANSITION = '240ms cubic-bezier(0.22, 0.61, 0.36, 1)';
const MATERIALS_STAGE_WIDTH = 'min(92vw, 1610px)';
const REEL_ALIGNED_COPY_STYLE: React.CSSProperties = { width: HIGHLIGHT_CARD_WIDTH, marginInline: 'auto' };
const MATERIALS_STAGE_WRAP_STYLE: React.CSSProperties = { width: MATERIALS_STAGE_WIDTH, marginInline: 'auto' };

const MATERIALS: MaterialConfig[] = [
  {
    id: 'acrylic',
    label: 'Acrylic',
    bubbleTitle: 'Acrylic.',
    bubbleBody: 'Bright, clean light with a crisp finish. A minimal look that stays quiet in the architecture.',
    media: {
      browse: {
        mediaType: 'video',
        src: '/videos/gable-acrylic.mp4',
        ariaLabel: 'Acrylic roof video',
        playbackRate: 2,
      },
      focus: {
        mediaType: 'video',
        src: '/videos/gable-acrylic.mp4',
        ariaLabel: 'Acrylic roof video',
        playbackRate: 2,
      },
    },
  },
  {
    id: 'timber',
    label: 'Timber',
    bubbleTitle: 'Timber.',
    bubbleBody: 'Warm texture and a softer atmosphere. Designed to feel like part of the home, not an add-on.',
    media: {
      browse: {
        mediaType: 'video',
        src: '/videos/timber-pitched.mp4',
        ariaLabel: 'Timber roof video',
        playbackRate: 1,
      },
      focus: {
        mediaType: 'video',
        src: '/videos/timber-pitched.mp4',
        ariaLabel: 'Timber roof video',
        playbackRate: 1,
      },
    },
  },
  {
    id: 'combo',
    label: 'Combination',
    bubbleTitle: 'Combination.',
    bubbleBody: 'Balance warmth and precision. A composed mix that lets structure stay clean while texture does the work.',
    media: {
      browse: {
        mediaType: 'video',
        src: '/videos/combination-gable.mp4',
        ariaLabel: 'Combination roof video',
        playbackRate: 3,
      },
      focus: {
        mediaType: 'video',
        src: '/videos/combination-gable.mp4',
        ariaLabel: 'Combination roof video',
        playbackRate: 3,
      },
    },
  },
  {
    id: 'aluminium',
    label: 'Aluminium',
    bubbleTitle: 'Aluminium.',
    bubbleBody: 'Powder-coated finish with precise lines. Choose a color that sits quietly with the exterior palette.',
    media: {
      browse: {
        src: '/images/product-gable-01.jpg',
        alt: 'Aluminium material option',
        fit: 'contain',
      },
      focus: {
        src: '/images/product-gable-02.jpg',
        alt: 'Aluminium material close-up',
        fit: 'cover',
        position: 'center',
      },
    },
    aluminiumColors: [
      {
        id: 'silver',
        label: 'Silver',
        hex: '#c7c7cc',
        media: {
          browse: {
            src: '/images/product-gable-01.jpg',
            alt: 'Aluminium in silver',
            fit: 'contain',
          },
          focus: {
            src: '/images/product-gable-02.jpg',
            alt: 'Aluminium in silver close-up',
            fit: 'cover',
          },
        },
      },
      {
        id: 'white',
        label: 'White',
        hex: '#f5f5f7',
        media: {
          browse: {
            src: '/images/product-pitched-01.jpg',
            alt: 'Aluminium in white',
            fit: 'contain',
          },
          focus: {
            src: '/images/product-pitched-02.jpg',
            alt: 'Aluminium in white close-up',
            fit: 'cover',
          },
        },
      },
      {
        id: 'black',
        label: 'Black',
        hex: '#1d1d1f',
        media: {
          browse: {
            src: '/images/product-hip-01.jpg',
            alt: 'Aluminium in black',
            fit: 'contain',
          },
          focus: {
            src: '/images/product-hip-02.jpg',
            alt: 'Aluminium in black close-up',
            fit: 'cover',
          },
        },
      },
      {
        id: 'bronze',
        label: 'Bronze',
        hex: '#7a6450',
        media: {
          browse: {
            src: '/images/product-perimeter-01.jpg',
            alt: 'Aluminium in bronze',
            fit: 'contain',
          },
          focus: {
            src: '/images/product-pitched-03.jpg',
            alt: 'Aluminium in bronze close-up',
            fit: 'cover',
          },
        },
      },
    ],
  },
];

const HIGHLIGHT_CARDS: HighlightCard[] = [
  {
    id: 'roof-shape-pitched',
    eyebrow: 'Roof Shape',
    title: 'Pitched',
    body: 'A single clean pitch that keeps the form minimal and drainage straightforward.',
    media: {
      mediaType: 'video',
      src: '/videos/pitched-subtle-movement.mp4',
      ariaLabel: 'Pitched roof subtle movement video',
      playbackRate: 1,
    },
    tone: 'light',
  },
  {
    id: 'roof-shape-gable',
    eyebrow: 'Roof Shape',
    title: 'Gable',
    body: 'A classic ridge profile that opens up volume while staying balanced in elevation.',
    media: {
      mediaType: 'video',
      src: '/videos/gable-subtle-movement.mp4',
      ariaLabel: 'Gable roof subtle movement video',
      playbackRate: 1,
    },
    tone: 'light',
  },
  {
    id: 'roof-shape-hip',
    eyebrow: 'Roof Shape',
    title: 'Hip',
    body: 'A composed, wrapped form that softens scale and reads more residential.',
    media: {
      mediaType: 'video',
      src: '/videos/hip-subtle-movement.mp4',
      ariaLabel: 'Hip roof subtle movement video',
      playbackRate: 1,
    },
    tone: 'light',
  },
  {
    id: 'roof-shape-box-perimeter',
    eyebrow: 'Roof Shape',
    title: 'Box-perimeter',
    body: 'A crisp perimeter frame with strong horizontals for an architectural expression.',
    media: {
      mediaType: 'video',
      src: '/videos/box-subtle-movement.mp4',
      ariaLabel: 'Box-perimeter roof subtle movement video',
      playbackRate: 1,
    },
    tone: 'light',
  },
];

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M6.25 1.5h1.5v11h-1.5zM1.5 6.25h11v1.5h-11z" fill="currentColor" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M12.5 10L8 5.5 3.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 6L8 10.5 12.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10 12.5L5.5 8 10 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 3.5L10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function roofTypeFitQualitativeLabel(level: RoofTypeFitMeters[keyof RoofTypeFitMeters]) {
  if (level <= 2) return 'Low';
  if (level === 3) return 'Moderate';
  return 'High';
}

function RoofTypeFitSection({ debug }: { debug?: boolean }) {
  const [selected, setSelected] = React.useState<RoofTypeFitId>('acrylic');
  const [isSwapping, setIsSwapping] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const selectedConfig = ROOF_TYPE_FIT_CONFIG[selected];
  const selectedIndex = ROOF_TYPE_FIT_OPTIONS.indexOf(selected);
  const hasMountedRef = React.useRef(false);

  React.useEffect(() => {
    if (prefersReducedMotion) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setIsSwapping(true);
    const timeoutId = window.setTimeout(() => setIsSwapping(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, selected]);

  return (
    <section className={cn('bg-page -mt-[clamp(8px,1.2vh,14px)] pb-[clamp(12px,3vh,38px)]', debug && 'outline outline-1 outline-sky-500/30')}>
      <div className="ui-box-center-viewport">
        <div className="ui-box-center ui-line-surface overflow-hidden border-card bg-card">
          <div className="border-b border-page px-4 pb-4 pt-5 md:px-6 md:pb-5 md:pt-6 [border-bottom-width:var(--bw)]">
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Roof response</p>
            <h3 className="mt-2 text-balance text-[clamp(24px,2.8vw,40px)] font-semibold leading-[1.08] tracking-[-0.015em] text-ink">
              Compare how each roof type performs.
            </h3>
          </div>

          <div className="border-b border-page p-2 md:p-3 [border-bottom-width:var(--bw)]">
            <div
              role="group"
              aria-label="Roof type selector"
              className="relative grid grid-cols-3 overflow-hidden border border-page bg-[#dee1e5] [border-width:var(--bw)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[#4a3d3d]"
                style={{
                  transform: `translateX(${selectedIndex * 100}%)`,
                  transition: prefersReducedMotion ? 'none' : 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                }}
              />

              {ROOF_TYPE_FIT_OPTIONS.map((option, index) => {
                const cfg = ROOF_TYPE_FIT_CONFIG[option];
                const isSelected = option === selected;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelected(option)}
                    aria-pressed={isSelected}
                    className={cn(
                      'relative z-10 h-14 px-3 text-center text-[13px] font-semibold uppercase tracking-[0.08em]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-inset',
                      index < ROOF_TYPE_FIT_OPTIONS.length - 1 && 'border-r border-page/60 [border-right-width:var(--bw)]',
                      isSelected ? 'text-white' : 'text-ink/75 hover:text-ink'
                    )}
                    style={{ transition: prefersReducedMotion ? 'none' : 'color 220ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              'space-y-5 p-4 md:space-y-6 md:px-6 md:py-6',
              !prefersReducedMotion && 'transition-opacity duration-200 ease-out',
              !prefersReducedMotion && isSwapping && 'opacity-90'
            )}
          >
            {ROOF_TYPE_FIT_ROWS.map((row) => {
              const level = selectedConfig.meters[row.key];
              const qualitative = roofTypeFitQualitativeLabel(level);
              const fillPercent = (level / 5) * 100;
              return (
                <div key={row.key} className="grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(170px,220px)_minmax(340px,1fr)_100px] sm:items-center sm:gap-x-4 sm:gap-y-0">
                  <span className="text-[13px] font-semibold uppercase tracking-[0.09em] text-ink md:text-[14px]">{row.label}</span>

                  <div role="img" aria-label={`${row.label}: ${level} of 5`} className="w-full max-w-[700px]">
                    <div className="relative h-4 md:h-[18px]">
                      <div className="absolute inset-0 grid grid-cols-5 gap-1.5">
                        {Array.from({ length: 5 }, (_, index) => (
                          <span key={`${row.key}-base-${index}`} className="border border-page bg-[#d6d9de] [border-width:var(--bw)]" />
                        ))}
                      </div>

                      <div
                        className="absolute inset-0 grid grid-cols-5 gap-1.5"
                        style={{
                          clipPath: `inset(0 ${100 - fillPercent}% 0 0)`,
                          transition: prefersReducedMotion ? 'none' : 'clip-path 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                        }}
                      >
                        {Array.from({ length: 5 }, (_, index) => {
                          const edgeAccent = index === level - 1;
                          return (
                            <span
                              key={`${row.key}-fill-${index}`}
                              className="border [border-width:var(--bw)]"
                              style={{
                                backgroundColor: edgeAccent ? '#724443' : '#3f434a',
                                borderColor: edgeAccent ? '#724443' : '#3f434a',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted sm:text-right">{qualitative}</span>
                </div>
              );
            })}

            <div className="border-t border-page pt-3 [border-top-width:var(--bw)]">
              <p className="text-[12px] leading-[1.45] text-muted">Scale guide: 1 indicates lower influence, 5 indicates stronger influence.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StartExploreClient({ debug }: { debug?: boolean }) {
  const [active, setActive] = React.useState<MaterialId>('acrylic');
  const [mode, setMode] = React.useState<Mode>('browse');
  const [aluColor, setAluColor] = React.useState<AluminiumColorId>('silver');
  const [videoReplayNonce, setVideoReplayNonce] = React.useState(0);
  const [highlightsSidePad, setHighlightsSidePad] = React.useState(16);
  const [selectedHighlightId, setSelectedHighlightId] = React.useState(HIGHLIGHT_CARDS[0]?.id ?? '');
  const [isDesktopHighlights, setIsDesktopHighlights] = React.useState(false);
  const [isHighlightsExpanded, setIsHighlightsExpanded] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const prevActiveRef = React.useRef<MaterialId>('acrylic');
  const highlightsTrackRef = React.useRef<HTMLDivElement | null>(null);
  const highlightCardRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightLastActivatorRef = React.useRef<string | null>(null);

  const isFocus = mode === 'focus';
  const isCompactHighlights = isDesktopHighlights && !isHighlightsExpanded;
  const shouldCenterHighlightsTrack = !isDesktopHighlights || isHighlightsExpanded;
  const compactCardWidth = `calc((100% - ${COMPACT_HIGHLIGHT_GAP_PX * (HIGHLIGHT_CARDS.length - 1)}px) / ${HIGHLIGHT_CARDS.length})`;
  const activeCfg = MATERIALS.find((m) => m.id === active) ?? MATERIALS[0];
  const aluminiumCfg = activeCfg.id === 'aluminium' ? activeCfg : null;
  const activeAlu = aluminiumCfg?.aluminiumColors?.find((c) => c.id === aluColor) ?? null;

  const mediaSpec: MediaSpec = (() => {
    if (aluminiumCfg && activeAlu) {
      return isFocus ? activeAlu.media.focus : activeAlu.media.browse;
    }
    return isFocus ? activeCfg.media.focus : activeCfg.media.browse;
  })();

  React.useEffect(() => {
    const prev = prevActiveRef.current;

    const activeCfgNow = MATERIALS.find((m) => m.id === active);
    const activeIsVideo = activeCfgNow?.media.browse.mediaType === 'video' || activeCfgNow?.media.focus.mediaType === 'video';
    if (activeIsVideo && prev !== active) {
      setVideoReplayNonce((current) => current + 1);
    }

    prevActiveRef.current = active;
  }, [active]);

  const activeStageVideoPlaybackRate = mediaSpec.mediaType === 'video' ? mediaSpec.playbackRate : undefined;

  const enforceVideoPlaybackRate = React.useCallback((video: HTMLVideoElement, playbackRate?: number) => {
    const safePlaybackRate = playbackRate ?? DEFAULT_VIDEO_PLAYBACK_RATE;
    if (video.defaultPlaybackRate !== safePlaybackRate) {
      video.defaultPlaybackRate = safePlaybackRate;
    }
    if (video.playbackRate !== safePlaybackRate) {
      video.playbackRate = safePlaybackRate;
    }
  }, []);

  const onStageVideoLoadedMetadata = React.useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      enforceVideoPlaybackRate(event.currentTarget, activeStageVideoPlaybackRate);
    },
    [activeStageVideoPlaybackRate, enforceVideoPlaybackRate]
  );

  const onStageVideoPlay = React.useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      enforceVideoPlaybackRate(event.currentTarget, activeStageVideoPlaybackRate);
    },
    [activeStageVideoPlaybackRate, enforceVideoPlaybackRate]
  );

  const onStageVideoEnded = React.useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const finalTime = Math.max(video.duration - 1 / 60, 0);
      if (Math.abs(video.currentTime - finalTime) > 0.001) {
        video.currentTime = finalTime;
      }
    }
    video.pause();
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(DESKTOP_HIGHLIGHTS_BREAKPOINT);
    const apply = () => setIsDesktopHighlights(media.matches);

    apply();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  React.useEffect(() => {
    if (!isDesktopHighlights) return;
    setIsHighlightsExpanded(false);
  }, [isDesktopHighlights]);

  const recalcHighlightsSidePad = React.useCallback(() => {
    const track = highlightsTrackRef.current;
    if (!track) return;
    if (!shouldCenterHighlightsTrack) {
      setHighlightsSidePad(0);
      return;
    }

    const firstCard = track.querySelector<HTMLElement>('[data-highlight-card]');
    if (!firstCard) return;

    const minPad = isDesktopHighlights ? 40 : window.innerWidth >= 768 ? 24 : 16;
    const centeredPad = Math.max(minPad, (track.clientWidth - firstCard.clientWidth) / 2);

    setHighlightsSidePad((current) => (Math.abs(current - centeredPad) > 0.5 ? centeredPad : current));
  }, [isDesktopHighlights, shouldCenterHighlightsTrack]);

  React.useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        recalcHighlightsSidePad();
      });
    };

    schedule();
    window.addEventListener('resize', schedule);

    const track = highlightsTrackRef.current;
    let observer: ResizeObserver | null = null;
    if (track && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(track);

      const firstCard = track.querySelector<HTMLElement>('[data-highlight-card]');
      if (firstCard) {
        observer.observe(firstCard);
      }
    }

    return () => {
      window.removeEventListener('resize', schedule);
      if (observer) observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [recalcHighlightsSidePad]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let frame = window.requestAnimationFrame(() => {
      recalcHighlightsSidePad();
    });
    const timeout = window.setTimeout(() => {
      recalcHighlightsSidePad();
    }, 280);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [recalcHighlightsSidePad, isCompactHighlights, isHighlightsExpanded]);

  const findCenteredHighlightCardIndex = React.useCallback((track: HTMLDivElement, cards: HTMLElement[]) => {
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let centeredIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const distance = Math.abs(cardCenter - trackCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        centeredIndex = index;
      }
    });

    return centeredIndex;
  }, []);

  const scrollHighlightCardToCenter = React.useCallback(
    (card: HTMLElement) => {
      const track = highlightsTrackRef.current;
      if (!track) return;

      const targetLeft = card.offsetLeft + card.clientWidth / 2 - track.clientWidth / 2;
      track.scrollTo({ left: targetLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    },
    [prefersReducedMotion]
  );

  const centerHighlightCardById = React.useCallback(
    (highlightId: string) => {
      const track = highlightsTrackRef.current;
      if (!track) return;
      const targetCard = track.querySelector<HTMLElement>(`[data-highlight-card-id="${highlightId}"]`);
      if (!targetCard) return;
      scrollHighlightCardToCenter(targetCard);
    },
    [scrollHighlightCardToCenter]
  );

  const scrollHighlights = React.useCallback((direction: -1 | 1) => {
    const track = highlightsTrackRef.current;
    if (!track) return;

    const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-highlight-card]'));
    if (!cards.length) return;

    const currentIndex = findCenteredHighlightCardIndex(track, cards);
    const targetIndex = Math.min(cards.length - 1, Math.max(0, currentIndex + direction));
    const targetCard = cards[targetIndex];
    const targetId = targetCard.getAttribute('data-highlight-card-id');
    if (targetId) {
      setSelectedHighlightId(targetId);
    }
    scrollHighlightCardToCenter(targetCard);
  }, [findCenteredHighlightCardIndex, scrollHighlightCardToCenter]);

  const closeExpandedHighlights = React.useCallback(() => {
    if (!isDesktopHighlights || !isHighlightsExpanded) return;
    setIsHighlightsExpanded(false);
  }, [isDesktopHighlights, isHighlightsExpanded]);

  React.useEffect(() => {
    if (!isDesktopHighlights || !isHighlightsExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeExpandedHighlights();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeExpandedHighlights, isDesktopHighlights, isHighlightsExpanded]);

  React.useEffect(() => {
    if (!shouldCenterHighlightsTrack) return;
    if (!selectedHighlightId) return;
    const frame = window.requestAnimationFrame(() => {
      centerHighlightCardById(selectedHighlightId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerHighlightCardById, selectedHighlightId, shouldCenterHighlightsTrack]);

  React.useEffect(() => {
    if (!isCompactHighlights) return;
    const returnTarget = highlightLastActivatorRef.current;
    if (!returnTarget) return;

    const frame = window.requestAnimationFrame(() => {
      highlightCardRefs.current[returnTarget]?.focus();
      highlightLastActivatorRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isCompactHighlights]);

  function enterFocus(nextActive?: MaterialId) {
    if (nextActive) setActive(nextActive);
    setMode('focus');
  }

  function cycle(delta: number) {
    const idx = MATERIALS.findIndex((m) => m.id === active);
    const next = (idx + delta + MATERIALS.length) % MATERIALS.length;
    setActive(MATERIALS[next].id);
    setMode('focus');
  }

  function onPillClick(id: MaterialId) {
    return () => {
      if (isFocus) {
        setActive(id);
        return;
      }
      enterFocus(id);
    };
  }

  const showSwatches = isFocus && active === 'aluminium' && Boolean(aluminiumCfg?.aluminiumColors);

  return (
    <main className="min-h-dvh bg-page text-ink [color-scheme:light]">
      <section className={cn('border-b border-page bg-page [border-bottom-width:var(--bw)]', debug && 'outline outline-1 outline-rose-500/40')}>
        <Container className="py-[clamp(40px,8vh,112px)]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Design chapter</p>
            <h1 className="mt-3 text-balance text-[clamp(34px,4vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
              Take a closer look.
            </h1>
            <p className="mx-auto mt-4 max-w-[58ch] text-[17px] leading-[1.6] text-muted">
              Dial in roof and light behavior with the same material controls used in design conversations.
            </p>
          </div>
        </Container>
      </section>

      <section className={cn('border-b border-page bg-page [border-bottom-width:var(--bw)]', debug && 'outline outline-1 outline-cyan-500/30')}>
        <Container className="py-8 md:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[68ch]">
              <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Highlights</p>
              <h2 className="mt-2 text-[clamp(28px,3.2vw,42px)] font-semibold leading-[1.08] tracking-[-0.015em] text-ink">
                Sanctuary roof shape studies.
              </h2>
              <p className="mt-3 text-[16px] leading-[1.6] text-muted">
                Review pitched, gable, hip and box-perimeter forms in motion before locking in your shape direction.
              </p>
            </div>

            {isDesktopHighlights && isHighlightsExpanded ? (
              <div className="hidden items-center gap-2 lg:flex">
                <LineGlyphButton aria-label="Previous roof shape" onClick={() => scrollHighlights(-1)}>
                  <IconChevronLeft />
                </LineGlyphButton>
                <LineGlyphButton aria-label="Next roof shape" onClick={() => scrollHighlights(1)}>
                  <IconChevronRight />
                </LineGlyphButton>
                <LineGlyphButton aria-label="Close expanded roof shape view" onClick={closeExpandedHighlights}>
                  <IconClose />
                </LineGlyphButton>
              </div>
            ) : null}
          </div>
        </Container>

        <div
          ref={highlightsTrackRef}
          className={cn(
            'flex gap-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-6 md:pb-10',
            isCompactHighlights ? 'overflow-hidden snap-none' : 'snap-x snap-mandatory overflow-x-auto'
          )}
          aria-label="Roof shape highlights"
          style={{
            width: isCompactHighlights ? HIGHLIGHT_CARD_WIDTH : undefined,
            marginInline: isCompactHighlights ? 'auto' : undefined,
            paddingLeft: shouldCenterHighlightsTrack ? `${highlightsSidePad}px` : undefined,
            paddingRight: shouldCenterHighlightsTrack ? `${highlightsSidePad}px` : undefined,
            transition: prefersReducedMotion ? 'none' : `padding ${HIGHLIGHT_TRANSITION}`,
          }}
        >
          {HIGHLIGHT_CARDS.map((card) => {
            const selected = card.id === selectedHighlightId;
            const textTone = card.tone ?? 'light';
            const cardVideoPlaybackRate = card.media.mediaType === 'video' ? card.media.playbackRate : undefined;

            return (
              <button
                key={card.id}
                ref={(el) => {
                  highlightCardRefs.current[card.id] = el;
                }}
                type="button"
                data-highlight-card
                data-highlight-card-id={card.id}
                onClick={(event) => {
                  setSelectedHighlightId(card.id);

                  if (isCompactHighlights) {
                    highlightLastActivatorRef.current = card.id;
                    setIsHighlightsExpanded(true);
                    return;
                  }

                  if (isDesktopHighlights && isHighlightsExpanded) {
                    scrollHighlightCardToCenter(event.currentTarget);
                    return;
                  }

                  const track = highlightsTrackRef.current;
                  if (!track) return;
                  const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-highlight-card]'));
                  const clickedIndex = cards.indexOf(event.currentTarget);
                  if (clickedIndex < 0) return;

                  const centeredIndex = findCenteredHighlightCardIndex(track, cards);
                  if (clickedIndex !== centeredIndex) {
                    scrollHighlightCardToCenter(event.currentTarget);
                  }
                }}
                className={cn(
                  'group relative h-[640px] shrink-0 overflow-hidden border border-page bg-card text-left [border-width:var(--bw)]',
                  !isCompactHighlights && 'snap-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  selected && 'ring-1 ring-brand/45'
                )}
                style={{
                  width: isCompactHighlights ? compactCardWidth : HIGHLIGHT_CARD_WIDTH,
                  transition: prefersReducedMotion ? 'none' : `width ${HIGHLIGHT_TRANSITION}`,
                }}
                aria-label={card.title}
                aria-pressed={selected}
                aria-expanded={isDesktopHighlights ? isHighlightsExpanded && selected : undefined}
              >
                {card.media.mediaType === 'video' ? (
                  <video
                    autoPlay={!prefersReducedMotion}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={card.media.ariaLabel}
                    tabIndex={-1}
                    className="h-full w-full object-cover"
                    onLoadedMetadata={(event) => {
                      enforceVideoPlaybackRate(event.currentTarget, cardVideoPlaybackRate);
                    }}
                    onPlay={(event) => {
                      enforceVideoPlaybackRate(event.currentTarget, cardVideoPlaybackRate);
                    }}
                  >
                    <source src={card.media.src} type="video/mp4" />
                  </video>
                ) : (
                  <Image
                    src={card.media.src}
                    alt={card.media.alt}
                    fill
                    sizes="(max-width: 768px) 88vw, (max-width: 1280px) 88vw, 1288px"
                    className={card.media.fit === 'contain' ? 'h-full w-full object-contain' : 'h-full w-full object-cover'}
                    style={{ objectPosition: card.media.position ?? 'center' }}
                  />
                )}

                <div
                  className={cn(
                    'pointer-events-none absolute inset-0',
                    textTone === 'dark' ? 'bg-gradient-to-t from-white/95 via-white/45 to-transparent' : 'bg-gradient-to-t from-black/65 via-black/25 to-transparent'
                  )}
                />

                <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 p-5 md:p-8', textTone === 'dark' ? 'text-ink' : 'text-white')}>
                  <p className={cn('text-[11px] uppercase tracking-[0.12em]', textTone === 'dark' ? 'text-muted' : 'text-white/85')}>
                    {card.eyebrow}
                  </p>
                  <h3 className="mt-2 text-[clamp(22px,2.7vw,36px)] font-semibold leading-[1.12] tracking-[-0.015em]">{card.title}</h3>
                  <p className={cn('mt-3 max-w-[58ch] text-[15px] leading-[1.6]', textTone === 'dark' ? 'text-muted' : 'text-white/90')}>
                    {card.body}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={cn('bg-page py-[clamp(36px,7vh,104px)]', debug && 'outline outline-1 outline-emerald-500/35')}>
        <div style={REEL_ALIGNED_COPY_STYLE}>
          <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Materials.</p>
          <h2 className="mt-3 max-w-[24ch] text-balance text-[clamp(32px,4.4vw,62px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
            Bright and open, or cool and shaded - dial it in with materials.
          </h2>
          <p className="mt-6 max-w-[76ch] text-[17px] leading-[1.66] text-muted">
            Material choice sets the tone for the entire pergola - how light moves through it, how warm it feels, how much upkeep it asks for, and how it will age over time.{' '}
            <span className="text-ink">Acrylic keeps spaces bright and open. Timber adds warmth and texture. Combination systems balance both.</span>{' '}
            Aluminium stays crisp and architectural, with colour options that sit quietly alongside your exterior palette.
          </p>
        </div>
      </section>

      <section className="bg-page py-[clamp(20px,4.5vh,56px)]">
        <div style={MATERIALS_STAGE_WRAP_STYLE}>
          <article
            className={cn(
              'ui-line-surface relative overflow-hidden',
              'lg:h-[684px]',
              debug && 'outline outline-1 outline-rose-500/40'
            )}
          >
            {isFocus ? (
              <div className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
                <LineGlyphButton aria-label="Previous material" onClick={() => cycle(-1)}>
                  <IconChevronUp />
                </LineGlyphButton>
                <LineGlyphButton aria-label="Next material" onClick={() => cycle(1)}>
                  <IconChevronDown />
                </LineGlyphButton>
              </div>
            ) : null}

              <div className="grid gap-6 p-4 md:p-6 lg:h-full lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)] lg:gap-0 lg:p-8">
                <div className="flex min-h-0 flex-col overflow-hidden lg:border-r lg:border-card lg:pr-8 lg:[border-right-width:var(--bw)]">
                  <div className="ui-line-surface overflow-hidden border-card bg-card">
                    {MATERIALS.map((m, index) => {
                      const activeRow = m.id === active;
                      const dotColor = m.id === 'aluminium' && activeRow && activeAlu ? activeAlu.hex : undefined;
                      const rowHasDivider = index < MATERIALS.length - 1 || (activeRow && isFocus);
                      const bubbleHasDivider = index < MATERIALS.length - 1;

                      return (
                        <React.Fragment key={m.id}>
                          <button
                            type="button"
                            onClick={onPillClick(m.id)}
                            className={cn(
                              'ui-line-option',
                              activeRow && 'ui-line-option-active',
                              rowHasDivider && 'border-b border-page [border-bottom-width:var(--bw)]'
                            )}
                            aria-current={activeRow ? 'true' : undefined}
                            aria-expanded={activeRow && isFocus ? true : undefined}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex size-3 items-center justify-center" aria-hidden="true">
                                <span
                                  className={cn('ui-line-dot', activeRow && 'ui-line-dot-active')}
                                  style={activeRow && dotColor ? { backgroundColor: dotColor } : undefined}
                                />
                              </span>
                              <span className="ui-line-option-label truncate">{m.label}</span>
                            </span>

                            <span className="ui-line-symbol" aria-hidden="true" style={{ opacity: activeRow ? 0 : 1 }}>
                              <IconPlus />
                            </span>
                          </button>

                          {activeRow && isFocus ? (
                            <div
                              className={cn(
                                'bg-card p-4',
                                bubbleHasDivider && 'border-b border-page [border-bottom-width:var(--bw)]'
                              )}
                            >
                              <p className="text-[15px] leading-[1.55] text-muted">{activeCfg.bubbleBody}</p>

                              {showSwatches && aluminiumCfg?.aluminiumColors ? (
                                <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-1" aria-label="Aluminium colours">
                                  {aluminiumCfg.aluminiumColors.map((c) => {
                                    const selected = c.id === aluColor;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className={cn('ui-line-swatch', selected && 'ui-line-swatch-selected')}
                                        style={{ backgroundColor: c.hex }}
                                        aria-label={c.label}
                                        aria-pressed={selected}
                                        onClick={() => setAluColor(c.id)}
                                      />
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden lg:pl-8">
                  <div className="relative h-[420px] overflow-hidden border border-card bg-card md:h-[520px] lg:h-full">
                    {mediaSpec.mediaType === 'video' ? (
                      <video
                        key={`${mediaSpec.src}:${videoReplayNonce}`}
                        autoPlay={!prefersReducedMotion}
                        muted
                        playsInline
                        preload="metadata"
                        aria-label={mediaSpec.ariaLabel}
                        tabIndex={-1}
                        className="h-full w-full object-cover"
                        onLoadedMetadata={onStageVideoLoadedMetadata}
                        onPlay={onStageVideoPlay}
                        onEnded={onStageVideoEnded}
                      >
                        <source src={mediaSpec.src} type="video/mp4" />
                      </video>
                    ) : (
                      <Image
                        key={mediaSpec.src}
                        src={mediaSpec.src}
                        alt={mediaSpec.alt}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 68vw"
                        className={mediaSpec.fit === 'contain' ? 'h-full w-full object-contain' : 'h-full w-full object-cover'}
                        style={{ objectPosition: mediaSpec.position ?? 'center' }}
                      />
                    )}
                  </div>
                </div>
              </div>
          </article>
        </div>
      </section>

      <RoofTypeFitSection debug={debug} />

      <section className="border-y border-page bg-page [border-top-width:var(--bw)] [border-bottom-width:var(--bw)]">
        <Container className="py-6">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-between">
            <p className="text-sm text-muted">Selections update instantly as you click.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
              <ButtonLink href="/contact" variant="brand" size="md" className="rounded-none">
                Book a Design Consultation
              </ButtonLink>
              <ButtonLink href="/start" variant="outline" size="md" className="rounded-none">
                Start the guide
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
