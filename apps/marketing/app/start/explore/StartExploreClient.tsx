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
  benefitLine: string;
  bestFor: string;
  expanded: {
    ceilingFeel: string;
    aestheticAlignment: string;
    ctaLabel: string;
  };
  deepDive: {
    goodFitIf: [string, string, string];
    notIdealIf: [string, string, string];
  };
  compactMedia: ImageMediaSpec;
  expandedMedia: VideoMediaSpec;
  tone?: 'light' | 'dark';
};

type RoofTypeFitMeters = {
  daylight: 1 | 2 | 3 | 4 | 5;
  heatGlare: 1 | 2 | 3 | 4 | 5;
  rainNoise: 1 | 2 | 3 | 4 | 5;
};

type RoofTypeFitMedia = {
  src: string;
  ariaLabel: string;
  playbackRate: number;
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
const ROOF_TYPE_MEDIA_COMBO_VERSION = '20260302-114943';
const ROOF_TYPE_MEDIA_TIMBER_VERSION = '20260302-114843';

const ROOF_TYPE_FIT_MEDIA: Record<RoofTypeFitId, RoofTypeFitMedia> = {
  acrylic: {
    src: `/videos/materials-combo.mp4?v=${ROOF_TYPE_MEDIA_COMBO_VERSION}`,
    ariaLabel: 'Acrylic roof material video',
    playbackRate: 1,
  },
  timber: {
    src: `/videos/materials-timber.mp4?v=${ROOF_TYPE_MEDIA_TIMBER_VERSION}`,
    ariaLabel: 'Timber roof material video',
    playbackRate: 1,
  },
  combo: {
    src: `/videos/materials-combo.mp4?v=${ROOF_TYPE_MEDIA_COMBO_VERSION}`,
    ariaLabel: 'Combination roof material video',
    playbackRate: 1,
  },
};

const ROOF_TYPE_FIT_COPY: Record<RoofTypeFitId, string> = {
  acrylic:
    'Maximises daylight while filtering UV, reducing glare, and keeping the space protected from rain.',
  timber: 'Delivers the most shade and acoustic comfort, ideal for bright north-facing decks.',
  combo: 'Balances daylight and shade for the most versatile all-round performance.',
};

const ROOF_TYPE_FIT_ROWS: Array<{
  key: keyof RoofTypeFitMeters;
  label: string;
}> = [
  { key: 'daylight', label: 'Daylight' },
  { key: 'heatGlare', label: 'Heat & glare' },
  { key: 'rainNoise', label: 'Rain-noise' },
];

const ROOF_TYPE_BAR_FILLED_COLOR = '#3a3d44';
const ROOF_TYPE_BAR_UNFILLED_COLOR = '#dfe2e6';
const ROOF_TYPE_BAR_UNFILLED_BORDER_COLOR = '#cfd3d8';
const ROOF_TYPE_TOGGLE_ACTIVE_COLOR = '#76352f';

const DEFAULT_VIDEO_PLAYBACK_RATE = 2;
const HIGHLIGHT_CARD_WIDTH = 'min(88vw, 1288px)';
const DESKTOP_HIGHLIGHTS_BREAKPOINT = '(min-width: 1024px)';
const COMPACT_HIGHLIGHT_GAP_PX = 24;
const HIGHLIGHT_TRANSITION_MS = 1248;
const HIGHLIGHT_MOTION_EASING_POINTS = [0.25, 0.2, 0.35, 1] as const;
const HIGHLIGHT_MOTION_EASING_CSS = `cubic-bezier(${HIGHLIGHT_MOTION_EASING_POINTS.join(', ')})`;
const HIGHLIGHT_TRANSITION = `${HIGHLIGHT_TRANSITION_MS}ms ${HIGHLIGHT_MOTION_EASING_CSS}`;
const HIGHLIGHT_POST_EXPAND_FADE_DELAY_MS = 400;
const HIGHLIGHT_MEDIA_FADE_MS = 220;
const HIGHLIGHT_DEEP_DIVE_TRANSITION_MS = 250;
const HIGHLIGHT_HOVER_TRANSITION_MS = 260;
const HIGHLIGHT_HOVER_EASING_CSS = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const MATERIALS_STAGE_WIDTH = 'min(92vw, 1610px)';
const REEL_ALIGNED_COPY_STYLE: React.CSSProperties = { width: HIGHLIGHT_CARD_WIDTH, marginInline: 'auto' };
const MATERIALS_STAGE_WRAP_STYLE: React.CSSProperties = { width: MATERIALS_STAGE_WIDTH, marginInline: 'auto' };

function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function createUnitBezierEasing(x1: number, y1: number, x2: number, y2: number) {
  const ax = 1 - 3 * x2 + 3 * x1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (timeProgress: number) => {
    const progress = clamp01(timeProgress);

    if (x1 === y1 && x2 === y2) return progress;

    let t = progress;
    for (let i = 0; i < 6; i += 1) {
      const xError = sampleX(t) - progress;
      if (Math.abs(xError) < 1e-5) {
        return sampleY(t);
      }

      const derivative = sampleDerivativeX(t);
      if (Math.abs(derivative) < 1e-6) break;
      t -= xError / derivative;
    }

    let lower = 0;
    let upper = 1;
    t = progress;
    for (let i = 0; i < 10; i += 1) {
      const x = sampleX(t);
      if (Math.abs(x - progress) < 1e-5) break;
      if (x > progress) {
        upper = t;
      } else {
        lower = t;
      }
      t = (lower + upper) / 2;
    }

    return sampleY(t);
  };
}

const HIGHLIGHT_MOTION_EASE = createUnitBezierEasing(...HIGHLIGHT_MOTION_EASING_POINTS);

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
    benefitLine: 'A clean single-slope roofline that keeps the form minimal.',
    bestFor: 'Long terraces',
    expanded: {
      ceilingFeel: 'Directional slope with an airy "high edge"',
      aestheticAlignment: 'Minimal, linear architecture',
      ctaLabel: 'Choose Pitched',
    },
    deepDive: {
      goodFitIf: [
        'You want a simple, modern roofline with a clear direction',
        'Your space reads long and linear along the house',
        'You prefer the most understated silhouette',
      ],
      notIdealIf: [
        'You want a symmetrical centre peak (look at Gable)',
        'You want a softer, more residential roof form (look at Hip)',
        'You want a strong framed edge (look at Box Perimeter)',
      ],
    },
    compactMedia: {
      src: '/images/pitch-landing.jpg',
      alt: 'Pitched roof shape landing image',
      fit: 'cover',
    },
    expandedMedia: {
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
    benefitLine: 'A centred ridge form that adds height and volume.',
    bestFor: 'Large sliders',
    expanded: {
      ceilingFeel: 'Lifted centre height that makes the space feel bigger',
      aestheticAlignment: 'Balanced profile with a timeless presence',
      ctaLabel: 'Choose Gable',
    },
    deepDive: {
      goodFitIf: [
        'You want the space to feel taller and more "open" through the middle',
        'You like a balanced, symmetrical roof silhouette',
        'You want the pergola to read as a defined outdoor room',
      ],
      notIdealIf: [
        'You want the flattest, most minimal line (look at Box Perimeter)',
        'You want a single-direction expression (look at Pitched)',
        'You want a more wrapped, sheltered feel (look at Hip)',
      ],
    },
    compactMedia: {
      src: '/images/gable-landing.jpg',
      alt: 'Gable roof shape landing image',
      fit: 'cover',
    },
    expandedMedia: {
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
    benefitLine: 'A wrapped roof form that feels composed and residential.',
    bestFor: 'Corner decks',
    expanded: {
      ceilingFeel: 'Sheltered and cohesive, with a "tucked in" edge',
      aestheticAlignment: 'Softer silhouette that suits residential forms',
      ctaLabel: 'Choose Hip',
    },
    deepDive: {
      goodFitIf: [
        'Your deck is exposed on more than one side (corner / open edges)',
        'You want the pergola to feel integrated with the home',
        'You prefer a softer roof shape from multiple viewpoints',
      ],
      notIdealIf: [
        'You want maximum height and volume (look at Gable)',
        'You want the most minimal silhouette (look at Pitched)',
        'You want crisp, strong horizontals (look at Box Perimeter)',
      ],
    },
    compactMedia: {
      src: '/images/hip-landing.jpg',
      alt: 'Hip roof shape landing image',
      fit: 'cover',
    },
    expandedMedia: {
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
    title: 'Box Perimeter',
    benefitLine: 'A crisp perimeter frame with strong horizontals.',
    bestFor: 'Modern courtyards',
    expanded: {
      ceilingFeel: 'Calm flat plane with a defined perimeter edge',
      aestheticAlignment: 'Contemporary, architectural, clean-lined homes',
      ctaLabel: 'Choose Box Perimeter',
    },
    deepDive: {
      goodFitIf: [
        'You want a strong framed edge and a defined "outdoor room" feel',
        'Your home is contemporary / flat-roof / clean-lined',
        'You like bold horizontals and a crisp architectural expression',
      ],
      notIdealIf: [
        'You want a classic roof profile (look at Gable or Hip)',
        'You want a visible pitch direction (look at Pitched)',
        'You want a softer residential silhouette (look at Hip)',
      ],
    },
    compactMedia: {
      src: '/images/box-landing.jpg',
      alt: 'Box Perimeter roof shape landing image',
      fit: 'cover',
    },
    expandedMedia: {
      mediaType: 'video',
      src: '/videos/box-subtle-movement.mp4',
      ariaLabel: 'Box Perimeter roof subtle movement video',
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

function RoofTypeFitSection({ debug }: { debug?: boolean }) {
  const [selected, setSelected] = React.useState<RoofTypeFitId>('acrylic');
  const [isSwapping, setIsSwapping] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const selectedConfig = ROOF_TYPE_FIT_CONFIG[selected];
  const selectedMedia = ROOF_TYPE_FIT_MEDIA[selected];
  const selectedCopy = ROOF_TYPE_FIT_COPY[selected];
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
    <section className={cn('bg-page py-8 md:py-14', debug && 'outline outline-1 outline-sky-500/30')}>
      <div className="ui-box-center-viewport">
        <div className="mx-auto w-full max-w-[1610px] px-4 md:px-6">
          <div className="ui-line-surface relative overflow-hidden border-card bg-card p-[18px] md:p-6 lg:min-h-[clamp(380px,34vw,500px)]">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[calc(100%-clamp(360px,28vw,480px)-20px)] top-[72px] hidden w-px bg-page lg:block lg:bottom-[calc(100%-clamp(360px,28vw,480px)-24px)]"
            />

            <div className="grid items-start gap-8 lg:grid-cols-[1fr_auto] lg:gap-10">
              <div className="min-w-0 pb-3">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Roof response</p>
                  <h3 className="mt-[10px] text-balance text-[clamp(26px,3.1vw,44px)] font-semibold leading-[1.06] tracking-[-0.018em] text-ink">
                    Compare how each roof type performs.
                  </h3>
                </div>

                <div className="mt-[44px] lg:mt-12">
                  <div
                    role="group"
                    aria-label="Roof type selector"
                    className="relative grid grid-cols-3 overflow-hidden border border-page bg-[#e6e9ec] [border-width:var(--bw)]"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
                      style={{
                        backgroundColor: ROOF_TYPE_TOGGLE_ACTIVE_COLOR,
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
                            'relative z-10 h-[51px] px-3 text-center text-[13px] font-medium uppercase tracking-[0.07em]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35 focus-visible:ring-inset',
                            index < ROOF_TYPE_FIT_OPTIONS.length - 1 && 'border-r border-page/60 [border-right-width:var(--bw)]',
                            isSelected ? 'font-semibold text-white' : 'text-ink/75 hover:text-ink'
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
                    'mt-[56px] space-y-5',
                    !prefersReducedMotion && 'transition-opacity duration-200 ease-out',
                    !prefersReducedMotion && isSwapping && 'opacity-90'
                  )}
                >
                  {ROOF_TYPE_FIT_ROWS.map((row) => {
                    const level = selectedConfig.meters[row.key];
                    const fillPercent = (level / 5) * 100;
                    return (
                      <div key={row.key} className="grid grid-cols-1 gap-y-[14px] sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] sm:items-center sm:gap-x-3 sm:gap-y-0">
                        <span className="text-[14px] font-medium uppercase tracking-[0.05em] text-ink md:text-[15px]">{row.label}</span>

                        <div role="img" aria-label={`${row.label}: ${level} of 5`} className="w-full">
                          <div className="relative h-[7px] md:h-[8px]">
                            <div className="absolute inset-0 grid grid-cols-5 gap-1.5">
                              {Array.from({ length: 5 }, (_, index) => (
                                <span
                                  key={`${row.key}-base-${index}`}
                                  className="border [border-width:var(--bw)]"
                                  style={{
                                    backgroundColor: ROOF_TYPE_BAR_UNFILLED_COLOR,
                                    borderColor: ROOF_TYPE_BAR_UNFILLED_BORDER_COLOR,
                                  }}
                                />
                              ))}
                            </div>

                            <div
                              className="absolute inset-0 grid grid-cols-5 gap-1.5"
                              style={{
                                clipPath: `inset(0 ${100 - fillPercent}% 0 0)`,
                                transition: prefersReducedMotion ? 'none' : 'clip-path 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                              }}
                            >
                              {Array.from({ length: 5 }, (_, index) => (
                                <span
                                  key={`${row.key}-fill-${index}`}
                                  className="border [border-width:var(--bw)]"
                                  style={{
                                    backgroundColor: ROOF_TYPE_BAR_FILLED_COLOR,
                                    borderColor: ROOF_TYPE_BAR_FILLED_COLOR,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-10 text-center text-[16px] leading-[1.45] text-muted/75 md:text-[17px]">{selectedCopy}</p>
              </div>

              <div className="mx-auto min-w-0 w-[min(88vw,420px)] max-w-full self-start lg:mx-0 lg:w-[clamp(360px,28vw,480px)]">
                <div className="relative aspect-square w-full overflow-hidden">
                  <video
                    key={`${selected}:${selectedMedia.src}`}
                    autoPlay={!prefersReducedMotion}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={selectedMedia.ariaLabel}
                    tabIndex={-1}
                    className="h-full w-full object-cover object-[50%_42%] scale-[1.06]"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (video.defaultPlaybackRate !== selectedMedia.playbackRate) {
                        video.defaultPlaybackRate = selectedMedia.playbackRate;
                      }
                      if (video.playbackRate !== selectedMedia.playbackRate) {
                        video.playbackRate = selectedMedia.playbackRate;
                      }
                    }}
                    onPlay={(event) => {
                      const video = event.currentTarget;
                      if (video.playbackRate !== selectedMedia.playbackRate) {
                        video.playbackRate = selectedMedia.playbackRate;
                      }
                    }}
                  >
                    <source src={selectedMedia.src} type="video/mp4" />
                  </video>
                </div>
              </div>
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
  const [isHighlightsWidthTransitioning, setIsHighlightsWidthTransitioning] = React.useState(false);
  const [highlightVideoReadyMap, setHighlightVideoReadyMap] = React.useState<Record<string, boolean>>({});
  const [highlightVideoVisibleMap, setHighlightVideoVisibleMap] = React.useState<Record<string, boolean>>({});
  const [isHighlightFadeGateOpen, setIsHighlightFadeGateOpen] = React.useState(false);
  const [settleHighlightId, setSettleHighlightId] = React.useState<string | null>(null);
  const [deepDiveOpenForId, setDeepDiveOpenForId] = React.useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const prevActiveRef = React.useRef<MaterialId>('acrylic');
  const highlightsTrackRef = React.useRef<HTMLDivElement | null>(null);
  const materialsSectionRef = React.useRef<HTMLElement | null>(null);
  const highlightCardContainerRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const highlightCardRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightDeepDiveTriggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightDeepDiveCloseRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightLastActivatorRef = React.useRef<string | null>(null);
  const highlightFadeGateTimeoutRef = React.useRef<number | null>(null);
  const highlightWidthTransitionTimeoutRef = React.useRef<number | null>(null);
  const highlightExpandStartRafRef = React.useRef<number | null>(null);
  const highlightExpandAlignRafRef = React.useRef<number | null>(null);
  const pendingExpandTargetIdRef = React.useRef<string | null>(null);
  const expandVectorStartedForIdRef = React.useRef<string | null>(null);
  const wasHighlightsWidthTransitioningRef = React.useRef(false);

  const isFocus = mode === 'focus';
  const isCompactHighlights = isDesktopHighlights && !isHighlightsExpanded;
  const isDesktopExpandedHighlights = isDesktopHighlights && isHighlightsExpanded;
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

  const clearHighlightFadeGateTimeout = React.useCallback(() => {
    if (highlightFadeGateTimeoutRef.current == null) return;
    window.clearTimeout(highlightFadeGateTimeoutRef.current);
    highlightFadeGateTimeoutRef.current = null;
  }, []);

  const clearHighlightWidthTransitionTimeout = React.useCallback(() => {
    if (highlightWidthTransitionTimeoutRef.current == null) return;
    window.clearTimeout(highlightWidthTransitionTimeoutRef.current);
    highlightWidthTransitionTimeoutRef.current = null;
  }, []);

  const clearHighlightExpandStartFrame = React.useCallback(() => {
    if (highlightExpandStartRafRef.current == null) return;
    window.cancelAnimationFrame(highlightExpandStartRafRef.current);
    highlightExpandStartRafRef.current = null;
  }, []);

  const clearHighlightExpandAlignFrame = React.useCallback(() => {
    if (highlightExpandAlignRafRef.current == null) return;
    window.cancelAnimationFrame(highlightExpandAlignRafRef.current);
    highlightExpandAlignRafRef.current = null;
  }, []);

  const startHighlightsWidthTransition = React.useCallback(() => {
    clearHighlightWidthTransitionTimeout();
    if (!isDesktopHighlights || prefersReducedMotion) {
      setIsHighlightsWidthTransitioning(false);
      return;
    }

    setIsHighlightsWidthTransitioning(true);
    highlightWidthTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsHighlightsWidthTransitioning(false);
      highlightWidthTransitionTimeoutRef.current = null;
    }, HIGHLIGHT_TRANSITION_MS);
  }, [clearHighlightWidthTransitionTimeout, isDesktopHighlights, prefersReducedMotion]);

  const showHighlightVideo = React.useCallback((highlightId: string) => {
    setHighlightVideoVisibleMap((current) => {
      if (current[highlightId]) return current;
      return { ...current, [highlightId]: true };
    });
  }, []);

  const onHighlightExpandedVideoReady = React.useCallback(
    (highlightId: string, video: HTMLVideoElement, playbackRate?: number) => {
      enforceVideoPlaybackRate(video, playbackRate);
      setHighlightVideoReadyMap((current) => {
        if (current[highlightId]) return current;
        return { ...current, [highlightId]: true };
      });

      if (!isDesktopExpandedHighlights || !isHighlightFadeGateOpen) return;
      showHighlightVideo(highlightId);
    },
    [enforceVideoPlaybackRate, isDesktopExpandedHighlights, isHighlightFadeGateOpen, showHighlightVideo]
  );

  React.useEffect(() => {
    return () => {
      clearHighlightFadeGateTimeout();
      clearHighlightWidthTransitionTimeout();
      clearHighlightExpandStartFrame();
      clearHighlightExpandAlignFrame();
    };
  }, [clearHighlightExpandAlignFrame, clearHighlightExpandStartFrame, clearHighlightFadeGateTimeout, clearHighlightWidthTransitionTimeout]);

  React.useEffect(() => {
    clearHighlightFadeGateTimeout();
    clearHighlightWidthTransitionTimeout();
    clearHighlightExpandStartFrame();
    clearHighlightExpandAlignFrame();
    pendingExpandTargetIdRef.current = null;
    expandVectorStartedForIdRef.current = null;
    setSettleHighlightId(null);
    setDeepDiveOpenForId(null);
    if (!isDesktopHighlights) {
      setIsHighlightsExpanded(false);
      setIsHighlightsWidthTransitioning(false);
      setIsHighlightFadeGateOpen(false);
      setHighlightVideoReadyMap({});
      setHighlightVideoVisibleMap({});
      return;
    }

    setIsHighlightsExpanded(false);
    setIsHighlightsWidthTransitioning(false);
    setIsHighlightFadeGateOpen(false);
    setHighlightVideoReadyMap({});
    setHighlightVideoVisibleMap({});
  }, [
    clearHighlightExpandAlignFrame,
    clearHighlightExpandStartFrame,
    clearHighlightFadeGateTimeout,
    clearHighlightWidthTransitionTimeout,
    isDesktopHighlights,
  ]);

  React.useEffect(() => {
    clearHighlightFadeGateTimeout();
    if (!isDesktopExpandedHighlights) {
      setIsHighlightFadeGateOpen(false);
      setHighlightVideoReadyMap({});
      setHighlightVideoVisibleMap({});
      return;
    }

    setIsHighlightFadeGateOpen(false);
    setHighlightVideoReadyMap({});
    setHighlightVideoVisibleMap({});

    if (prefersReducedMotion) {
      setIsHighlightFadeGateOpen(true);
      return;
    }

    highlightFadeGateTimeoutRef.current = window.setTimeout(() => {
      setIsHighlightFadeGateOpen(true);
      highlightFadeGateTimeoutRef.current = null;
    }, HIGHLIGHT_TRANSITION_MS + HIGHLIGHT_POST_EXPAND_FADE_DELAY_MS);
  }, [clearHighlightFadeGateTimeout, isDesktopExpandedHighlights, prefersReducedMotion]);

  React.useEffect(() => {
    if (!isDesktopExpandedHighlights || !isHighlightFadeGateOpen) return;
    if (!highlightVideoReadyMap[selectedHighlightId]) return;
    showHighlightVideo(selectedHighlightId);
  }, [highlightVideoReadyMap, isDesktopExpandedHighlights, isHighlightFadeGateOpen, selectedHighlightId, showHighlightVideo]);

  const recalcHighlightsSidePad = React.useCallback(() => {
    const track = highlightsTrackRef.current;
    if (!track) return;
    if (isHighlightsWidthTransitioning) return;
    if (!shouldCenterHighlightsTrack) {
      setHighlightsSidePad(0);
      return;
    }

    const firstCard = track.querySelector<HTMLElement>('[data-highlight-card]');
    if (!firstCard) return;

    const minPad = isDesktopHighlights ? 40 : window.innerWidth >= 768 ? 24 : 16;
    const centeredPad = Math.max(minPad, (track.clientWidth - firstCard.clientWidth) / 2);

    setHighlightsSidePad((current) => (Math.abs(current - centeredPad) > 0.5 ? centeredPad : current));
  }, [isDesktopHighlights, isHighlightsWidthTransitioning, shouldCenterHighlightsTrack]);

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
    }, HIGHLIGHT_TRANSITION_MS + 40);

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
    (card: HTMLElement, behaviorOverride?: ScrollBehavior) => {
      const track = highlightsTrackRef.current;
      if (!track) return;

      const targetLeft = card.offsetLeft + card.clientWidth / 2 - track.clientWidth / 2;
      const behavior = behaviorOverride ?? (prefersReducedMotion ? 'auto' : 'smooth');
      track.scrollTo({ left: targetLeft, behavior });
    },
    [prefersReducedMotion]
  );

  const centerHighlightCardById = React.useCallback(
    (highlightId: string, behaviorOverride?: ScrollBehavior) => {
      const track = highlightsTrackRef.current;
      if (!track) return;
      const targetCard = track.querySelector<HTMLElement>(`[data-highlight-card-id="${highlightId}"]`);
      if (!targetCard) return;
      scrollHighlightCardToCenter(targetCard, behaviorOverride);
    },
    [scrollHighlightCardToCenter]
  );

  const getExpandedHighlightMetrics = React.useCallback((track: HTMLDivElement) => {
    const expandedCardWidth = Math.min(window.innerWidth * 0.88, 1288);
    const computedTrackStyle = window.getComputedStyle(track);
    const gapValue = Number.parseFloat(computedTrackStyle.columnGap || computedTrackStyle.gap || '') || COMPACT_HIGHLIGHT_GAP_PX;
    const minPad = 40;
    const sidePad = Math.max(minPad, (track.clientWidth - expandedCardWidth) / 2);

    return {
      expandedCardWidth,
      gapValue,
      sidePad,
      trackWidth: track.clientWidth,
    };
  }, []);

  const getEstimatedExpandedTargetLeft = React.useCallback(
    (highlightId: string, metrics: ReturnType<typeof getExpandedHighlightMetrics>) => {
      const cardIndex = HIGHLIGHT_CARDS.findIndex((card) => card.id === highlightId);
      if (cardIndex < 0) return null;

      const rawTarget =
        metrics.sidePad +
        cardIndex * (metrics.expandedCardWidth + metrics.gapValue) +
        metrics.expandedCardWidth / 2 -
        metrics.trackWidth / 2;
      const totalExpandedWidth =
        metrics.sidePad * 2 +
        HIGHLIGHT_CARDS.length * metrics.expandedCardWidth +
        (HIGHLIGHT_CARDS.length - 1) * metrics.gapValue;
      const maxLeft = Math.max(0, totalExpandedWidth - metrics.trackWidth);

      return Math.min(maxLeft, Math.max(0, rawTarget));
    },
    []
  );

  const startHighlightsExpandVectorScroll = React.useCallback(
    (highlightId: string) => {
      if (typeof window === 'undefined') return;
      const track = highlightsTrackRef.current;
      if (!track) return;

      const metrics = getExpandedHighlightMetrics(track);
      const targetLeft = getEstimatedExpandedTargetLeft(highlightId, metrics);
      if (targetLeft == null) return;

      setHighlightsSidePad(metrics.sidePad);
      clearHighlightExpandAlignFrame();
      track.scrollTo({ left: track.scrollLeft, behavior: 'auto' });

      if (prefersReducedMotion) {
        track.scrollTo({ left: targetLeft, behavior: 'auto' });
        return;
      }

      const startLeft = track.scrollLeft;
      const travel = targetLeft - startLeft;
      if (Math.abs(travel) < 0.5) {
        track.scrollTo({ left: targetLeft, behavior: 'auto' });
        return;
      }

      let startTime = 0;
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min(1, (timestamp - startTime) / HIGHLIGHT_TRANSITION_MS);
        const eased = HIGHLIGHT_MOTION_EASE(progress);
        track.scrollTo({ left: startLeft + travel * eased, behavior: 'auto' });

        if (progress < 1) {
          highlightExpandAlignRafRef.current = window.requestAnimationFrame(step);
          return;
        }

        track.scrollTo({ left: targetLeft, behavior: 'auto' });
        highlightExpandAlignRafRef.current = null;
      };

      highlightExpandAlignRafRef.current = window.requestAnimationFrame(step);
    },
    [clearHighlightExpandAlignFrame, getEstimatedExpandedTargetLeft, getExpandedHighlightMetrics, prefersReducedMotion]
  );

  React.useEffect(() => {
    clearHighlightExpandStartFrame();
    if (!isDesktopExpandedHighlights || !isHighlightsWidthTransitioning) {
      expandVectorStartedForIdRef.current = null;
      return;
    }

    const targetId = pendingExpandTargetIdRef.current;
    if (!targetId) return;
    if (expandVectorStartedForIdRef.current === targetId) return;

    highlightExpandStartRafRef.current = window.requestAnimationFrame(() => {
      highlightExpandStartRafRef.current = null;
      startHighlightsExpandVectorScroll(targetId);
      expandVectorStartedForIdRef.current = targetId;
    });

    return clearHighlightExpandStartFrame;
  }, [
    clearHighlightExpandStartFrame,
    isDesktopExpandedHighlights,
    isHighlightsWidthTransitioning,
    startHighlightsExpandVectorScroll,
  ]);

  const closeHighlightDeepDive = React.useCallback(
    (restoreFocusToTrigger: boolean) => {
      setDeepDiveOpenForId((current) => {
        if (!current) return current;
        if (restoreFocusToTrigger) {
          window.requestAnimationFrame(() => {
            highlightDeepDiveTriggerRefs.current[current]?.focus();
          });
        }
        return null;
      });
    },
    []
  );

  React.useEffect(() => {
    if (!deepDiveOpenForId) return;
    if (!isDesktopExpandedHighlights || deepDiveOpenForId !== selectedHighlightId) {
      setDeepDiveOpenForId(null);
    }
  }, [deepDiveOpenForId, isDesktopExpandedHighlights, selectedHighlightId]);

  React.useEffect(() => {
    if (!deepDiveOpenForId) return;
    const activeCard = highlightCardContainerRefs.current[deepDiveOpenForId];
    if (!activeCard) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusableElements = () =>
      Array.from(activeCard.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
      );

    const closeButton = highlightDeepDiveCloseRefs.current[deepDiveOpenForId];
    const initialFocusTarget = closeButton ?? getFocusableElements()[0];
    initialFocusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHighlightDeepDive(true);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === first || !activeCard.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeElement || activeElement === last || !activeCard.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeHighlightDeepDive, deepDiveOpenForId]);

  const handleHighlightCtaClick = React.useCallback(
    (card: HighlightCard) => {
      window.dispatchEvent(
        new CustomEvent('sanctuary:roof-shape-selected', {
          detail: { roofShapeId: card.id, roofShapeTitle: card.title },
        })
      );
      const nextSection = materialsSectionRef.current;
      if (!nextSection) return;
      nextSection.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [prefersReducedMotion]
  );

  const handleHighlightCardActivation = React.useCallback(
    (cardId: string) => {
      setSelectedHighlightId(cardId);
      const cardElement = highlightCardContainerRefs.current[cardId];
      if (!cardElement) return;

      if (isCompactHighlights) {
        highlightLastActivatorRef.current = cardId;
        pendingExpandTargetIdRef.current = cardId;
        expandVectorStartedForIdRef.current = null;
        setDeepDiveOpenForId(null);
        setIsHighlightsExpanded(true);
        startHighlightsWidthTransition();
        return;
      }

      if (isDesktopHighlights && isHighlightsExpanded) {
        scrollHighlightCardToCenter(cardElement);
        return;
      }

      const track = highlightsTrackRef.current;
      if (!track) return;
      const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-highlight-card]'));
      const clickedIndex = cards.indexOf(cardElement);
      if (clickedIndex < 0) return;

      const centeredIndex = findCenteredHighlightCardIndex(track, cards);
      if (clickedIndex !== centeredIndex) {
        scrollHighlightCardToCenter(cardElement);
      }
    },
    [
      findCenteredHighlightCardIndex,
      isCompactHighlights,
      isDesktopHighlights,
      isHighlightsExpanded,
      scrollHighlightCardToCenter,
      startHighlightsWidthTransition,
    ]
  );

  const scrollHighlights = React.useCallback((direction: -1 | 1) => {
    if (isHighlightsWidthTransitioning) return;
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
  }, [findCenteredHighlightCardIndex, isHighlightsWidthTransitioning, scrollHighlightCardToCenter]);

  const closeExpandedHighlights = React.useCallback(() => {
    if (!isDesktopHighlights || !isHighlightsExpanded) return;
    clearHighlightExpandStartFrame();
    clearHighlightExpandAlignFrame();
    pendingExpandTargetIdRef.current = null;
    expandVectorStartedForIdRef.current = null;
    setSettleHighlightId(null);
    setDeepDiveOpenForId(null);
    startHighlightsWidthTransition();
    setIsHighlightsExpanded(false);
  }, [
    clearHighlightExpandAlignFrame,
    clearHighlightExpandStartFrame,
    isDesktopHighlights,
    isHighlightsExpanded,
    startHighlightsWidthTransition,
  ]);

  React.useEffect(() => {
    if (!isDesktopHighlights || !isHighlightsExpanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (deepDiveOpenForId) return;
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeExpandedHighlights();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeExpandedHighlights, deepDiveOpenForId, isDesktopHighlights, isHighlightsExpanded]);

  React.useEffect(() => {
    if (!shouldCenterHighlightsTrack) return;
    if (!selectedHighlightId) return;
    if (settleHighlightId) return;
    if (isHighlightsWidthTransitioning && isDesktopExpandedHighlights) return;
    const frame = window.requestAnimationFrame(() => {
      centerHighlightCardById(selectedHighlightId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerHighlightCardById, isDesktopExpandedHighlights, isHighlightsWidthTransitioning, selectedHighlightId, settleHighlightId, shouldCenterHighlightsTrack]);

  React.useEffect(() => {
    const wasTransitioning = wasHighlightsWidthTransitioningRef.current;
    wasHighlightsWidthTransitioningRef.current = isHighlightsWidthTransitioning;
    if (!wasTransitioning || isHighlightsWidthTransitioning) return;
    if (!isDesktopExpandedHighlights) return;
    const targetId = pendingExpandTargetIdRef.current ?? selectedHighlightId;
    if (!targetId) return;

    const frame = window.requestAnimationFrame(() => {
      clearHighlightExpandStartFrame();
      clearHighlightExpandAlignFrame();
      expandVectorStartedForIdRef.current = null;
      recalcHighlightsSidePad();
      setSettleHighlightId(targetId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    clearHighlightExpandAlignFrame,
    clearHighlightExpandStartFrame,
    isDesktopExpandedHighlights,
    isHighlightsWidthTransitioning,
    recalcHighlightsSidePad,
    selectedHighlightId,
  ]);

  React.useEffect(() => {
    if (!settleHighlightId) return;
    if (!isDesktopExpandedHighlights) {
      setSettleHighlightId(null);
      pendingExpandTargetIdRef.current = null;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      centerHighlightCardById(settleHighlightId, 'auto');
      setSettleHighlightId(null);
      pendingExpandTargetIdRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [centerHighlightCardById, isDesktopExpandedHighlights, settleHighlightId]);

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
                Review pitched, gable, hip and box perimeter forms in motion before locking in your shape direction.
              </p>
            </div>

            {isDesktopHighlights && isHighlightsExpanded ? (
              <div className="hidden items-center gap-2 lg:flex">
                <LineGlyphButton aria-label="Previous roof shape" onClick={() => scrollHighlights(-1)} disabled={isHighlightsWidthTransitioning}>
                  <IconChevronLeft />
                </LineGlyphButton>
                <LineGlyphButton aria-label="Next roof shape" onClick={() => scrollHighlights(1)} disabled={isHighlightsWidthTransitioning}>
                  <IconChevronRight />
                </LineGlyphButton>
                <LineGlyphButton aria-label="Close expanded roof shape view" onClick={closeExpandedHighlights} disabled={isHighlightsWidthTransitioning}>
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
            isCompactHighlights ? 'overflow-hidden snap-none' : 'overflow-x-auto',
            !isCompactHighlights && !isHighlightsWidthTransitioning && 'snap-x snap-mandatory',
            !isCompactHighlights && isHighlightsWidthTransitioning && 'snap-none'
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
            const shouldRenderExpandedVideo = !isCompactHighlights;
            const shouldRenderImageLayer = isCompactHighlights || isDesktopExpandedHighlights;
            const isVideoVisible = !isDesktopExpandedHighlights || Boolean(highlightVideoVisibleMap[card.id]);
            const cardVideoPlaybackRate = card.expandedMedia.playbackRate;
            const isCardInteractionLocked = isDesktopExpandedHighlights && isHighlightsWidthTransitioning;
            const isExpandedSelectedCard = isDesktopExpandedHighlights && selected;
            const isDeepDiveOpen = isExpandedSelectedCard && deepDiveOpenForId === card.id;
            const deepDiveTransition = prefersReducedMotion
              ? 'none'
              : `opacity ${HIGHLIGHT_DEEP_DIVE_TRANSITION_MS}ms ease-out, transform ${HIGHLIGHT_DEEP_DIVE_TRANSITION_MS}ms ease-out`;
            const compactHoverTransition = `${HIGHLIGHT_HOVER_TRANSITION_MS}ms ${HIGHLIGHT_HOVER_EASING_CSS}`;
            const cardWidthTransition = `width ${HIGHLIGHT_TRANSITION}`;
            const cardTransition = isCompactHighlights ? `${cardWidthTransition}, transform ${compactHoverTransition}` : cardWidthTransition;
            const imageTransition = prefersReducedMotion
              ? 'none'
              : `opacity ${HIGHLIGHT_MEDIA_FADE_MS}ms ease-out${isCompactHighlights ? `, transform ${compactHoverTransition}` : ''}`;

            return (
              <article
                key={card.id}
                ref={(el) => {
                  highlightCardContainerRefs.current[card.id] = el;
                }}
                data-highlight-card
                data-highlight-card-id={card.id}
                className={cn(
                  'group relative h-[640px] shrink-0 overflow-hidden border border-page bg-card text-left [border-width:var(--bw)]',
                  isCompactHighlights && 'motion-safe:transition-transform motion-safe:hover:-translate-y-[2px]',
                  !isCompactHighlights && 'snap-center'
                )}
                style={{
                  width: isCompactHighlights ? compactCardWidth : HIGHLIGHT_CARD_WIDTH,
                  transition: prefersReducedMotion ? 'none' : cardTransition,
                }}
              >
                <button
                  ref={(el) => {
                    highlightCardRefs.current[card.id] = el;
                  }}
                  type="button"
                  disabled={isCardInteractionLocked || isDeepDiveOpen}
                  onClick={() => handleHighlightCardActivation(card.id)}
                  className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset disabled:cursor-not-allowed"
                  aria-label={card.title}
                  aria-pressed={selected}
                  aria-expanded={isDesktopHighlights ? isHighlightsExpanded && selected : undefined}
                />

                {shouldRenderImageLayer ? (
                  <Image
                    src={card.compactMedia.src}
                    alt={card.compactMedia.alt}
                    fill
                    quality={95}
                    sizes={
                      isCompactHighlights
                        ? '(min-width: 1024px) 980px, 88vw'
                        : '(max-width: 768px) 88vw, (max-width: 1280px) 88vw, 1288px'
                    }
                    className={cn(
                      card.compactMedia.fit === 'contain' ? 'h-full w-full object-contain' : 'h-full w-full object-cover',
                      isCompactHighlights && 'motion-safe:group-hover:scale-[1.01]'
                    )}
                    style={{
                      objectPosition: card.compactMedia.position ?? 'center',
                      opacity: isDesktopExpandedHighlights && isVideoVisible ? 0 : 1,
                      transition: imageTransition,
                    }}
                  />
                ) : null}

                {shouldRenderExpandedVideo ? (
                  <video
                    autoPlay={!prefersReducedMotion}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={card.expandedMedia.ariaLabel}
                    tabIndex={-1}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      opacity: isVideoVisible ? 1 : 0,
                      transition: prefersReducedMotion ? 'none' : `opacity ${HIGHLIGHT_MEDIA_FADE_MS}ms ease-out`,
                    }}
                    onLoadedMetadata={(event) => {
                      enforceVideoPlaybackRate(event.currentTarget, cardVideoPlaybackRate);
                    }}
                    onLoadedData={(event) => {
                      onHighlightExpandedVideoReady(card.id, event.currentTarget, cardVideoPlaybackRate);
                    }}
                    onCanPlay={(event) => {
                      onHighlightExpandedVideoReady(card.id, event.currentTarget, cardVideoPlaybackRate);
                    }}
                    onPlay={(event) => {
                      enforceVideoPlaybackRate(event.currentTarget, cardVideoPlaybackRate);
                    }}
                  >
                    <source src={card.expandedMedia.src} type="video/mp4" />
                  </video>
                ) : null}

                {isCompactHighlights ? (
                  <div
                    className={cn(
                      'pointer-events-none absolute inset-3 z-20 border opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100',
                      textTone === 'dark' ? 'border-ink/25' : 'border-white/30'
                    )}
                  />
                ) : null}

                <div
                  className={cn(
                    'pointer-events-none absolute inset-0',
                    textTone === 'dark' ? 'bg-gradient-to-t from-white/95 via-white/45 to-transparent' : 'bg-gradient-to-t from-black/65 via-black/25 to-transparent'
                  )}
                />

                <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-20 p-5 md:p-8', textTone === 'dark' ? 'text-ink' : 'text-white')}>
                  <p
                    className={cn(
                      'text-[11px] uppercase tracking-[0.12em]',
                      textTone === 'dark' ? 'text-muted' : 'text-white/85',
                      isCompactHighlights && (textTone === 'dark' ? 'transition-colors duration-200 ease-out group-hover:text-ink' : 'transition-colors duration-200 ease-out group-hover:text-white')
                    )}
                  >
                    {card.eyebrow}
                  </p>
                  <h3
                    className={cn(
                      'mt-2 text-[clamp(22px,2.7vw,36px)] font-semibold leading-[1.12] tracking-[-0.015em]',
                      isCompactHighlights &&
                        (textTone === 'dark' ? 'transition-colors duration-200 ease-out group-hover:text-ink' : 'transition-colors duration-200 ease-out group-hover:text-white')
                    )}
                  >
                    {card.title}
                  </h3>
                  <p className={cn('mt-3 max-w-[58ch] text-[15px] leading-[1.6]', textTone === 'dark' ? 'text-muted' : 'text-white/90')}>
                    {card.benefitLine}
                  </p>

                  {isExpandedSelectedCard ? (
                    <div className={cn('mt-3 space-y-2 max-w-[58ch] text-[14px] leading-[1.5]', textTone === 'dark' ? 'text-muted' : 'text-white/88')}>
                      <p>
                        <span className={cn('font-semibold', textTone === 'dark' ? 'text-ink' : 'text-white')}>Ceiling feel:</span> {card.expanded.ceilingFeel}
                      </p>
                      <p>
                        <span className={cn('font-semibold', textTone === 'dark' ? 'text-ink' : 'text-white')}>Aesthetic alignment:</span> {card.expanded.aestheticAlignment}
                      </p>
                    </div>
                  ) : (
                    <span
                      className={cn(
                        'mt-3 inline-flex border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
                        textTone === 'dark' ? 'border-ink/20 bg-white/70 text-ink' : 'border-white/45 bg-black/25 text-white'
                      )}
                    >
                      Best for: {card.bestFor}
                    </span>
                  )}

                  {isCompactHighlights ? (
                    <p
                      className={cn(
                        'mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-0 transition-all duration-200 ease-out group-hover:translate-x-[1px] group-hover:opacity-100',
                        textTone === 'dark' ? 'text-ink/72' : 'text-white/78'
                      )}
                    >
                      Explore <span aria-hidden="true">→</span>
                    </p>
                  ) : null}
                </div>

                {isExpandedSelectedCard ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleHighlightCtaClick(card);
                    }}
                    disabled={isCardInteractionLocked}
                    className="absolute bottom-5 right-5 z-40 border border-white/90 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.09em] text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60 md:bottom-8 md:right-8"
                  >
                    {card.expanded.ctaLabel}
                  </button>
                ) : null}

                {isExpandedSelectedCard && !isDeepDiveOpen ? (
                  <button
                    ref={(el) => {
                      highlightDeepDiveTriggerRefs.current[card.id] = el;
                    }}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeepDiveOpenForId(card.id);
                    }}
                    disabled={isCardInteractionLocked}
                    aria-label={`Open deep dive for ${card.title}`}
                    className="absolute right-5 top-5 z-40 inline-flex size-10 items-center justify-center border border-black bg-black text-white transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60 md:right-8 md:top-8"
                  >
                    <IconPlus />
                  </button>
                ) : null}

                {isExpandedSelectedCard ? (
                  <div
                    className={cn('absolute inset-0 z-30 p-5 md:p-8', isDeepDiveOpen ? 'pointer-events-auto' : 'pointer-events-none')}
                    aria-hidden={!isDeepDiveOpen}
                  >
                    <div
                      className={cn('absolute inset-0 bg-black/72', isDeepDiveOpen ? 'opacity-100' : 'opacity-0')}
                      style={{ transition: prefersReducedMotion ? 'none' : `opacity ${HIGHLIGHT_DEEP_DIVE_TRANSITION_MS}ms ease-out` }}
                    />

                    <div
                      role={isDeepDiveOpen ? 'dialog' : undefined}
                      aria-modal={isDeepDiveOpen ? 'true' : undefined}
                      aria-label={isDeepDiveOpen ? `${card.title} deep dive` : undefined}
                      className={cn('relative flex h-full flex-col', isDeepDiveOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')}
                      style={{ transition: deepDiveTransition }}
                    >
                      <button
                        ref={(el) => {
                          highlightDeepDiveCloseRefs.current[card.id] = el;
                        }}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeHighlightDeepDive(true);
                        }}
                        className="absolute right-0 top-0 inline-flex size-10 items-center justify-center border border-white/75 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                        aria-label={`Close deep dive for ${card.title}`}
                      >
                        <IconClose />
                      </button>

                      <div className="mt-12 grid grid-cols-1 gap-6 overflow-y-auto pb-20 pr-1 text-white md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-3">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-white/80">{card.eyebrow}</p>
                          <h4 className="text-[clamp(22px,2.7vw,36px)] font-semibold leading-[1.12] tracking-[-0.015em]">{card.title}</h4>
                          <p className="max-w-[58ch] text-[15px] leading-[1.6] text-white/90">{card.benefitLine}</p>
                          <div className="space-y-2 max-w-[58ch] text-[14px] leading-[1.5] text-white/88">
                            <p>
                              <span className="font-semibold text-white">Ceiling feel:</span> {card.expanded.ceilingFeel}
                            </p>
                            <p>
                              <span className="font-semibold text-white">Aesthetic alignment:</span> {card.expanded.aestheticAlignment}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/88">Good fit if</h4>
                          <ul className="space-y-2 text-[14px] leading-[1.55] text-white/88">
                            {card.deepDive.goodFitIf.map((line) => (
                              <li key={`${card.id}-fit-${line}`} className="list-disc ml-4">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/88">Not ideal if</h4>
                          <ul className="space-y-2 text-[14px] leading-[1.55] text-white/88">
                            {card.deepDive.notIdealIf.map((line) => (
                              <li key={`${card.id}-not-${line}`} className="list-disc ml-4">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section ref={materialsSectionRef} className={cn('bg-page py-[clamp(36px,7vh,104px)]', debug && 'outline outline-1 outline-emerald-500/35')}>
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

      <section className="mt-7 border-y border-page bg-page [border-top-width:var(--bw)] [border-bottom-width:var(--bw)] lg:mt-10">
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
