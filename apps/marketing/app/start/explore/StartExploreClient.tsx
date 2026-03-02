'use client';

import * as React from 'react';
import Image from 'next/image';
import RoofComparisonSection from '@/components/explore/RoofComparisonSection';
import RoofStudiesSection, { type RoofShapeSelectedPayload } from '@/components/explore/RoofStudiesSection';
import { ButtonLink } from '@/components/ui/Button';
import Container from '@/components/ui/Container';
import { LineGlyphButton } from '@/components/ui/LineGlyphButton';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from './_foundation/usePrefersReducedMotion';

type MaterialId = 'acrylic' | 'timber' | 'combo' | 'aluminium';
type Mode = 'browse' | 'focus';
type AluminiumColorId = 'silver' | 'white' | 'black' | 'bronze';

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


const DEFAULT_VIDEO_PLAYBACK_RATE = 2;
const REEL_COPY_WIDTH = 'min(88vw, 1288px)';
const MATERIALS_STAGE_WIDTH = 'min(92vw, 1610px)';
const REEL_ALIGNED_COPY_STYLE: React.CSSProperties = { width: REEL_COPY_WIDTH, marginInline: 'auto' };
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


export default function StartExploreClient({ debug }: { debug?: boolean }) {
  const [active, setActive] = React.useState<MaterialId>('acrylic');
  const [mode, setMode] = React.useState<Mode>('browse');
  const [aluColor, setAluColor] = React.useState<AluminiumColorId>('silver');
  const [videoReplayNonce, setVideoReplayNonce] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const prevActiveRef = React.useRef<MaterialId>('acrylic');
  const materialsSectionRef = React.useRef<HTMLElement | null>(null);

  const isFocus = mode === 'focus';
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

  const handleRoofShapeSelected = React.useCallback((payload: RoofShapeSelectedPayload) => {
    window.dispatchEvent(new CustomEvent('sanctuary:roof-shape-selected', { detail: payload }));
  }, []);

  const handleRequestScrollToMaterials = React.useCallback((behavior: ScrollBehavior) => {
    const nextSection = materialsSectionRef.current;
    if (!nextSection) return;
    nextSection.scrollIntoView({ behavior, block: 'start' });
  }, []);

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

      <RoofStudiesSection
        debug={debug}
        onShapeSelected={handleRoofShapeSelected}
        onRequestScrollToNext={handleRequestScrollToMaterials}
      />

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

      <RoofComparisonSection debug={debug} />

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
