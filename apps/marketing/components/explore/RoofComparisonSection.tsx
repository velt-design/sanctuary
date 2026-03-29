'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { BRAND_ACCENT_HEX } from '@sp/theme';

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
const ROOF_TYPE_MEDIA_ACRYLIC_VERSION = '20260303-ffmpeg1';
const ROOF_TYPE_MEDIA_COMBO_VERSION = '20260303-ffmpeg1';
const ROOF_TYPE_MEDIA_TIMBER_VERSION = '20260303-ffmpeg1';

const ROOF_TYPE_FIT_MEDIA: Record<RoofTypeFitId, RoofTypeFitMedia> = {
  acrylic: {
    src: `/videos/materials-acrylic.mp4?v=${ROOF_TYPE_MEDIA_ACRYLIC_VERSION}`,
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
const ROOF_TYPE_TOGGLE_ACTIVE_COLOR = BRAND_ACCENT_HEX;
const INITIAL_VIDEO_READY_STATE: Record<RoofTypeFitId, boolean> = {
  acrylic: false,
  timber: false,
  combo: false,
};
const INITIAL_POSTER_INDEX_STATE: Record<RoofTypeFitId, number> = {
  acrylic: 0,
  timber: 0,
  combo: 0,
};

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

function useIsMobileViewport(maxWidth = 1023) {
  const [isMobile, setIsMobile] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setIsMobile(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener?.('change', sync);
    mediaQuery.addListener?.(sync);

    return () => {
      mediaQuery.removeEventListener?.('change', sync);
      mediaQuery.removeListener?.(sync);
    };
  }, [maxWidth]);

  return isMobile;
}

type RoofComparisonSectionProps = {
  debug?: boolean;
  className?: string;
};

export default function RoofComparisonSection({ debug, className }: RoofComparisonSectionProps) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const [selected, setSelected] = React.useState<RoofTypeFitId>('acrylic');
  const [isSwapping, setIsSwapping] = React.useState(false);
  const [isVideoReadyById, setIsVideoReadyById] =
    React.useState<Record<RoofTypeFitId, boolean>>(INITIAL_VIDEO_READY_STATE);
  const [posterIndexById, setPosterIndexById] =
    React.useState<Record<RoofTypeFitId, number>>(INITIAL_POSTER_INDEX_STATE);
  const [mobileVideoActivated, setMobileVideoActivated] = React.useState(false);
  const [isNearViewport, setIsNearViewport] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileViewport = useIsMobileViewport();
  const selectedVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const selectedConfig = ROOF_TYPE_FIT_CONFIG[selected];
  const selectedMedia = ROOF_TYPE_FIT_MEDIA[selected];
  const selectedCopy = ROOF_TYPE_FIT_COPY[selected];
  const selectedIndex = ROOF_TYPE_FIT_OPTIONS.indexOf(selected);
  const selectedPosterIndex = posterIndexById[selected] ?? 0;
  const selectedPosterSrc = selectedMedia.posterSrcs[selectedPosterIndex] ?? selectedMedia.posterSrcs[0];
  const isSelectedVideoReady = Boolean(isVideoReadyById[selected]);
  const shouldRenderSelectedVideo =
    !prefersReducedMotion &&
    isNearViewport &&
    isMobileViewport !== null &&
    (isMobileViewport === false || mobileVideoActivated);
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
    const sectionNode = sectionRef.current;
    if (!sectionNode) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(sectionNode);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const video = selectedVideoRef.current;
    if (!video) return;
    if (!shouldRenderSelectedVideo) {
      video.pause();
      return;
    }

    const playbackRate = selectedMedia.playbackRate;
    if (video.defaultPlaybackRate !== playbackRate) {
      video.defaultPlaybackRate = playbackRate;
    }
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate;
    }

    if (video.readyState >= 2) {
      void video.play().catch(() => {});
    }
  }, [selectedMedia.playbackRate, selectedMedia.src, shouldRenderSelectedVideo]);

  return (
    <section
      ref={sectionRef}
      className={cn('bg-page py-6 md:py-14', className, debug && 'outline outline-1 outline-sky-500/30')}
    >
      <div className="mx-auto w-full max-w-[1610px] px-4 md:px-6">
        <div className="ui-line-surface relative overflow-hidden border-card bg-card p-4 md:p-6 lg:min-h-[clamp(380px,34vw,500px)]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[calc(100%-clamp(360px,28vw,480px)-20px)] top-[72px] hidden w-px bg-page lg:block lg:bottom-[calc(100%-clamp(360px,28vw,480px)-24px)]"
          />

          <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto] lg:gap-x-10 lg:gap-y-0">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Roof response</p>
              <h3 className="mt-[8px] text-balance text-[clamp(26px,3.1vw,44px)] font-semibold leading-[1.06] tracking-[-0.018em] text-ink">
                Compare how each roof type performs.
              </h3>
            </div>

            <div
              className={cn(
                'min-w-0 space-y-4 pt-1 lg:col-start-1 lg:row-start-3 lg:mt-[44px] lg:space-y-5 lg:pt-0',
                !prefersReducedMotion && 'transition-opacity duration-200 ease-out',
                !prefersReducedMotion && isSwapping && 'opacity-90'
              )}
            >
              {ROOF_TYPE_FIT_ROWS.map((row) => {
                const level = selectedConfig.meters[row.key];
                const fillPercent = (level / 5) * 100;
                return (
                  <div key={row.key} className="grid grid-cols-1 gap-y-[10px] sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] sm:items-center sm:gap-x-3 sm:gap-y-0">
                    <span className="text-[13px] font-medium uppercase tracking-[0.05em] text-ink md:text-[15px]">{row.label}</span>

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

            <div className="mx-auto min-w-0 w-full max-w-[420px] self-start lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:mx-0 lg:w-[clamp(360px,28vw,480px)] lg:max-w-none">
              <div className="relative aspect-square w-full overflow-hidden bg-[#eceff2]">
                {selectedPosterSrc ? (
                  <Image
                    src={selectedPosterSrc}
                    alt=""
                    fill
                    aria-hidden="true"
                    quality={55}
                    sizes="(max-width: 640px) calc(100vw - 76px), (max-width: 1024px) 88vw, (max-width: 1440px) 35vw, 480px"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_42%] scale-100 md:scale-[1.06]"
                    style={{
                      opacity: shouldRenderSelectedVideo && isSelectedVideoReady ? 0 : 1,
                      transition: prefersReducedMotion ? 'none' : 'opacity 180ms ease-out',
                    }}
                    onError={() => {
                      setPosterIndexById((current) => {
                        const currentIndex = current[selected] ?? 0;
                        const next = currentIndex + 1;
                        if (next >= selectedMedia.posterSrcs.length) return current;
                        return {
                          ...current,
                          [selected]: next,
                        };
                      });
                    }}
                  />
                ) : null}

                {shouldRenderSelectedVideo ? (
                  <video
                    key={selectedMedia.src}
                    ref={selectedVideoRef}
                    autoPlay={false}
                    loop
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={selectedMedia.ariaLabel}
                    tabIndex={-1}
                    className="absolute inset-0 h-full w-full object-cover object-[50%_42%] scale-100 md:scale-[1.06]"
                    style={{
                      opacity: isSelectedVideoReady ? 1 : 0,
                      pointerEvents: 'none',
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
                    onLoadedData={(event) => {
                      setIsVideoReadyById((current) =>
                        current[selected] ? current : { ...current, [selected]: true }
                      );
                      if (shouldRenderSelectedVideo) {
                        void event.currentTarget.play().catch(() => {});
                      }
                    }}
                    onCanPlay={(event) => {
                      setIsVideoReadyById((current) =>
                        current[selected] ? current : { ...current, [selected]: true }
                      );
                      if (shouldRenderSelectedVideo) {
                        void event.currentTarget.play().catch(() => {});
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
                ) : null}

                {isMobileViewport === true && !mobileVideoActivated && !prefersReducedMotion ? (
                  <button
                    type="button"
                    onClick={() => setMobileVideoActivated(true)}
                    className="absolute bottom-3 right-3 z-10 border border-page bg-black/55 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-black/68 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 md:bottom-4 md:right-4"
                  >
                    Play motion preview
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:mt-12">
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
                        'relative z-10 h-[46px] px-2 text-center text-[12px] font-medium uppercase tracking-[0.06em] sm:h-[48px] sm:px-3 sm:text-[13px]',
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

            <p className="min-w-0 pt-1 text-center text-[15px] leading-[1.38] text-muted/75 sm:text-[16px] md:text-[17px] lg:col-start-1 lg:row-start-4 lg:mt-10 lg:pt-0">
              {selectedCopy}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
