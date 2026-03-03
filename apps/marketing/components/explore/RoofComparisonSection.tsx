'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

type RoofTypeFitId = 'acrylic' | 'timber' | 'combo';

type RoofTypeFitMeters = {
  daylight: 1 | 2 | 3 | 4 | 5;
  heatGlare: 1 | 2 | 3 | 4 | 5;
  rainNoise: 1 | 2 | 3 | 4 | 5;
};

type RoofTypeFitMedia = {
  src: string;
  posterSrcs: string[];
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
    src: '/videos/materials-acrylic.mp4',
    posterSrcs: ['/images/materials-acrylic.jpg'],
    ariaLabel: 'Acrylic roof material video',
    playbackRate: 1,
  },
  timber: {
    src: `/videos/materials-timber.mp4?v=${ROOF_TYPE_MEDIA_TIMBER_VERSION}`,
    posterSrcs: ['/images/materials-timber.jpg'],
    ariaLabel: 'Timber roof material video',
    playbackRate: 1,
  },
  combo: {
    src: `/videos/materials-combo.mp4?v=${ROOF_TYPE_MEDIA_COMBO_VERSION}`,
    posterSrcs: ['/images/materials-combination.jpg'],
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);

    onChange();

    mq.addEventListener?.('change', onChange);
    mq.addListener?.(onChange);

    return () => {
      mq.removeEventListener?.('change', onChange);
      mq.removeListener?.(onChange);
    };
  }, []);

  return reduced;
}

type RoofComparisonSectionProps = {
  debug?: boolean;
  className?: string;
};

export default function RoofComparisonSection({ debug, className }: RoofComparisonSectionProps) {
  const [selected, setSelected] = React.useState<RoofTypeFitId>('acrylic');
  const [isSwapping, setIsSwapping] = React.useState(false);
  const [isVideoReady, setIsVideoReady] = React.useState(false);
  const [posterIndex, setPosterIndex] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const selectedConfig = ROOF_TYPE_FIT_CONFIG[selected];
  const selectedMedia = ROOF_TYPE_FIT_MEDIA[selected];
  const selectedCopy = ROOF_TYPE_FIT_COPY[selected];
  const selectedIndex = ROOF_TYPE_FIT_OPTIONS.indexOf(selected);
  const selectedPosterSrc = selectedMedia.posterSrcs[posterIndex];
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

  React.useEffect(() => {
    setIsVideoReady(false);
    setPosterIndex(0);
  }, [selectedMedia.src]);

  return (
    <section className={cn('bg-page py-8 md:py-14', className, debug && 'outline outline-1 outline-sky-500/30')}>
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
                <div className="relative aspect-square w-full overflow-hidden bg-[#eceff2]">
                  {selectedPosterSrc ? (
                    <Image
                      key={`${selected}:poster:${selectedPosterSrc}`}
                      src={selectedPosterSrc}
                      alt=""
                      fill
                      aria-hidden="true"
                      sizes="(max-width: 1024px) 88vw, (max-width: 1440px) 35vw, 480px"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_42%] scale-[1.06]"
                      style={{
                        opacity: isVideoReady ? 0 : 1,
                        transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out',
                      }}
                      onError={() => {
                        setPosterIndex((current) => {
                          const next = current + 1;
                          return next < selectedMedia.posterSrcs.length ? next : current;
                        });
                      }}
                    />
                  ) : null}

                  <video
                    key={`${selected}:${selectedMedia.src}`}
                    autoPlay={!prefersReducedMotion}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    poster={selectedMedia.posterSrcs[0]}
                    aria-label={selectedMedia.ariaLabel}
                    tabIndex={-1}
                    className="absolute inset-0 h-full w-full object-cover object-[50%_42%] scale-[1.06]"
                    style={{
                      opacity: isVideoReady ? 1 : 0,
                      transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out',
                    }}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (video.defaultPlaybackRate !== selectedMedia.playbackRate) {
                        video.defaultPlaybackRate = selectedMedia.playbackRate;
                      }
                      if (video.playbackRate !== selectedMedia.playbackRate) {
                        video.playbackRate = selectedMedia.playbackRate;
                      }
                    }}
                    onLoadedData={() => setIsVideoReady(true)}
                    onCanPlay={() => setIsVideoReady(true)}
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
    </section>
  );
}
