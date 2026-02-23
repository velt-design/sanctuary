'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  startFlowContent,
  type EnquiryType,
  type ExtraId,
  type RoofMaterialChoice,
  type RoofStyle,
} from '@/app/start/startFlowContent';
import {
  ACRYLIC_TINT_MEDIA,
  BRANCH_MEDIA,
  EXTRA_MEDIA,
  ROOF_MATERIAL_MEDIA,
  ROOF_STYLE_MEDIA,
  TIMBER_FINISH_MEDIA,
  type MediaEntry,
} from '@/app/start/startFlowMedia';
import {
  clearStartExploreSelections,
  COMPARE_START_POINT_OPTIONS,
  ENCLOSURE_OPTIONS,
  getRoofSecondaryOptions,
  readStartExploreSelections,
  type StartExploreSelections,
  writeStartExploreSelections,
} from './startExploreStore';

type SectionId = 'hero' | 'highlights' | 'design' | 'roof' | 'performance' | 'shared' | 'extras' | 'compare' | 'cta';
type PillId = 'path' | 'roofStyle' | 'roofMaterial' | 'extras' | 'consent' | 'process';
type ReviewRowKey = 'path' | 'roofStyle' | 'roofMaterial' | 'enclosure' | 'extras' | 'compare';
type PerformanceTabId = 'wind' | 'rain' | 'heat' | 'comfort';

type CardOption = {
  id: string;
  title: string;
  description?: string;
  image?: MediaEntry;
};

type ReviewRow = {
  key: ReviewRowKey;
  label: string;
  value: string;
  anchor: SectionId;
  focusId: string;
};

type RoofStripStop = {
  id: string;
  label: string;
  caption: string;
  roofMaterial: RoofMaterialChoice;
  roofSecondary: string;
  image: MediaEntry;
};

type HighlightShelfItem = {
  id: string;
  title: string;
  subtitle: string;
  bullets: readonly [string, string];
  chapterId: Exclude<SectionId, 'hero' | 'cta'>;
  image: string;
  savedState?: 'design' | 'roof' | 'shared' | 'extras' | 'compare';
};

const SECTION_IDS: SectionId[] = ['hero', 'highlights', 'design', 'roof', 'performance', 'shared', 'extras', 'compare', 'cta'];

const NAV_ANCHORS: ReadonlyArray<{ id: Exclude<SectionId, 'hero' | 'cta'>; label: string }> = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'design', label: 'Design' },
  { id: 'roof', label: 'Roof' },
  { id: 'performance', label: 'Performance' },
  { id: 'shared', label: 'Shared' },
  { id: 'extras', label: 'Extras' },
  { id: 'compare', label: 'Compare' },
];

const PILL_ORDER: ReadonlyArray<{ id: PillId; label: string }> = [
  { id: 'path', label: 'Path' },
  { id: 'roofStyle', label: 'Roof style' },
  { id: 'roofMaterial', label: 'Roof material' },
  { id: 'extras', label: 'Extras' },
  { id: 'consent', label: 'Consent basics' },
  { id: 'process', label: 'What happens next' },
];

const ENCLOSURE_EXTRA_IDS = new Set<ExtraId>(['blinds', 'slats', 'acrylic_infills']);

const SHARED_FEATURES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Engineered for NZ sites',
    body: 'Span and fixing design responds to local wind zones and site exposure.',
  },
  {
    title: 'Precision fabrication',
    body: 'Factory-cut aluminium members deliver cleaner joins and a consistent fit.',
  },
  {
    title: 'Drainage strategy',
    body: 'Falls, gutters, and outlets are planned early for dependable runoff.',
  },
  {
    title: 'Low-maintenance materials',
    body: 'Durable coated aluminium and roof systems hold up in coastal conditions.',
  },
  {
    title: 'Lighting-ready pathways',
    body: 'Provision for downlights and strips keeps future upgrades straightforward.',
  },
  {
    title: 'Design Consultation workflow',
    body: 'Clear guidance moves your project from concept to build-ready detail.',
  },
];

const PERFORMANCE_TABS: ReadonlyArray<{
  id: PerformanceTabId;
  label: string;
  title: string;
  image: MediaEntry;
  bullets: readonly string[];
}> = [
  {
    id: 'wind',
    label: 'Wind',
    title: 'Wind behavior is designed in from the start.',
    image: { src: '/images/project-kiwi-rail-03.jpg', alt: 'Pergola frame designed for exposed wind conditions.' },
    bullets: [
      'Roof geometry and spans are tuned to site exposure and prevailing wind.',
      'Connection and post layouts are coordinated for long-term stability.',
    ],
  },
  {
    id: 'rain',
    label: 'Rain',
    title: 'Drainage strategy is set with the roof concept.',
    image: { src: '/images/project-asquith-ave-01.jpg', alt: 'Pergola roof line with integrated drainage path.' },
    bullets: [
      'Roof fall and outlet direction are planned early for clean runoff.',
      'Junction detailing keeps perimeter transitions drier in heavy weather.',
    ],
  },
  {
    id: 'heat',
    label: 'Heat/Glare',
    title: 'Light and comfort are balanced by material selection.',
    image: { src: '/images/product-pitched-04.jpg', alt: 'Acrylic roof tint controlling glare in bright sunlight.' },
    bullets: [
      'Acrylic, timber, and combination roofs balance brightness, shade, and warmth.',
      'Secondary roof options target glare control where it matters most.',
    ],
  },
  {
    id: 'comfort',
    label: 'Noise/Comfort',
    title: 'Daily usability is considered beyond pure shelter.',
    image: { src: '/images/project-goodhome-04.jpg', alt: 'Lit pergola at dusk showing comfort-focused extras.' },
    bullets: [
      'Lighting, screens, and heaters can be planned as integrated upgrades.',
      'Roof and enclosure choices support quieter, steadier daily use.',
    ],
  },
];

const COMPARE_OUTCOMES: Record<string, readonly string[]> = {
  no_cover: [
    'Rain cover extends everyday use across more of the year.',
    'Shelter, lighting, and finish choices make the space feel intentional.',
  ],
  old_pergola: [
    'Updated geometry can improve drainage and usable head height.',
    'Modern roof systems tune light, heat, and shelter more precisely.',
  ],
  umbrella_or_shade_sail: [
    'A permanent structure brings predictable weather cover and durability.',
    'Integrated lighting and enclosure options support regular evening use.',
  ],
  not_sure: [
    'Path, roof style, and material pairings quickly narrow the right direction.',
    'A Design Consultation turns that shortlist into a buildable plan.',
  ],
};

const ROOF_STRIP_STOPS: ReadonlyArray<RoofStripStop> = [
  {
    id: 'acrylic-clear',
    label: 'Acrylic clear',
    caption: 'Bright, open daylight with clear acrylic overhead.',
    roofMaterial: 'acrylic',
    roofSecondary: 'clear',
    image: ACRYLIC_TINT_MEDIA.clear,
  },
  {
    id: 'acrylic-opal',
    label: 'Acrylic opal',
    caption: 'Soft, diffused light for calmer glare control.',
    roofMaterial: 'acrylic',
    roofSecondary: 'opal',
    image: ACRYLIC_TINT_MEDIA.opal,
  },
  {
    id: 'timber-natural',
    label: 'Timber natural',
    caption: 'Warm timber character with balanced overhead shade.',
    roofMaterial: 'timber',
    roofSecondary: 'natural',
    image: TIMBER_FINISH_MEDIA.natural,
  },
  {
    id: 'combo-circulation',
    label: 'Combo circulation',
    caption: 'Targeted daylight over circulation routes.',
    roofMaterial: 'combination',
    roofSecondary: 'circulation',
    image: ROOF_MATERIAL_MEDIA.combination,
  },
  {
    id: 'combo-seating',
    label: 'Combo seating',
    caption: 'Targeted daylight above gathering zones.',
    roofMaterial: 'combination',
    roofSecondary: 'seating',
    image: ROOF_MATERIAL_MEDIA.combination,
  },
];

const HIGHLIGHT_ITEMS: ReadonlyArray<HighlightShelfItem> = [
  {
    id: 'design',
    title: 'Design',
    subtitle: 'Path, style, and material intent in one module.',
    bullets: ['Set the project direction early and keep a clear shortlist.', 'See style and material intent together before you commit.'],
    chapterId: 'design',
    image: '/images/project-westmere-01.jpg',
    savedState: 'design',
  },
  {
    id: 'roof',
    title: 'Roof and light',
    subtitle: 'Interactive strip for material and light behavior.',
    bullets: ['Compare how each roof choice shapes light, shade, and comfort.', 'Lock in material intent with a visual roof strip.'],
    chapterId: 'roof',
    image: '/images/product-pitched-03.jpg',
    savedState: 'roof',
  },
  {
    id: 'performance',
    title: 'Performance',
    subtitle: 'Wind, rain, heat, and comfort chapter.',
    bullets: ['Review wind, rain, heat, and comfort in one compact chapter.', 'Carry confident decisions into the final consultation.'],
    chapterId: 'performance',
    image: '/images/project-kiwi-rail-02.jpg',
  },
  {
    id: 'shared',
    title: 'Shared',
    subtitle: 'What every Sanctuary project includes.',
    bullets: ['See the baseline engineering and fabrication standard on every project.', 'Adjust enclosure feel to match privacy and shelter goals.'],
    chapterId: 'shared',
    image: '/images/project-atelier-shu-01.jpg',
    savedState: 'shared',
  },
  {
    id: 'extras',
    title: 'Extras',
    subtitle: 'Lighting, screens, and weather-control options.',
    bullets: ['Layer in lighting and weather control where they add daily value.', 'Keep optional upgrades in the same saved shortlist.'],
    chapterId: 'extras',
    image: '/images/product-downlight-01.jpg',
    savedState: 'extras',
  },
  {
    id: 'compare',
    title: 'Compare',
    subtitle: 'Quick worth-it framing for your starting point.',
    bullets: ['Frame likely gains based on your current outdoor setup.', 'Use the snapshot to guide a focused consultation.'],
    chapterId: 'compare',
    image: '/images/project-goodhome-01.jpg',
    savedState: 'compare',
  },
];

const SHELL = 'mx-auto w-full max-w-[1728px] px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-14';
const SECTION_Y = 'py-14 sm:py-16 lg:py-20 xl:py-24';
const SECTION_GAP = 'mt-8 sm:mt-10 lg:mt-12';
const COPY_RAIL = 'w-full max-w-[720px]';

const GRID_2COL = 'grid grid-cols-12 gap-y-10 xl:gap-y-0 xl:gap-x-10';
const COL_COPY = 'col-span-12 xl:col-span-5';
const COL_MEDIA = 'col-span-12 xl:col-span-7';

const KICKER = 'text-xs sm:text-sm font-medium text-white/62';
const H1 = 'text-balance font-semibold tracking-[-0.02em] leading-[1.05] text-[clamp(32px,4.2vw,56px)]';
const H2 = 'text-balance font-semibold tracking-[-0.015em] leading-[1.1] text-[clamp(22px,2.2vw,32px)]';
const H3 = 'text-balance font-semibold tracking-[-0.01em] leading-[1.15] text-[clamp(18px,1.4vw,22px)]';
const LEDE = 'mt-4 text-pretty text-base sm:text-lg leading-relaxed text-white/74 max-w-[60ch]';

const MODULE_SURFACE = 'rounded-3xl border border-white/10 bg-white/[0.03]';
const MODULE_INNER = 'overflow-hidden';
const MODULE_DIVIDE = 'divide-y divide-white/10';

const SHELF_ROW = 'flex gap-4 sm:gap-5 xl:gap-6 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const SHELF_CARD = 'w-[280px] sm:w-[320px] xl:w-[360px] 2xl:w-[400px] flex-none';

const CARD_BASE = 'rounded-2xl bg-black/35 ring-1 ring-white/10';
const CARD_HOVER = 'hover:bg-black/45 hover:ring-white/20';
const CARD_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

const SECTION_CONTAINER_CLASS = `w-full scroll-mt-20 ${SECTION_Y}`;
const SURFACE_CONTAINER_CLASS = SHELL;
const RAIL_SCROLL_OUTER_CLASS = 'overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const RAIL_TRACK_CLASS = 'mx-auto flex w-max snap-x snap-mandatory gap-4 sm:gap-5 xl:gap-6';
const ROOF_STRIP_CLASS = 'sticky top-0 z-50 w-full border-b border-border/15 bg-background/80 backdrop-blur';
const ROOF_STRIP_INNER_CLASS = 'flex h-12 items-center gap-3';
const ROOF_STRIP_RIGHT_CLASS = 'ml-auto flex items-center gap-3';
const ROOF_STRIP_PRIMARY_CTA_CLASS =
  'inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-4 text-sm font-medium leading-none text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';
const TAKE_LOOK_GRID_LG_CLASS = 'lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-0';
const TAKE_LOOK_MEDIA_ASPECT_CLASS =
  'relative w-full shrink-0 overflow-hidden aspect-[4/3] sm:aspect-[16/10] xl:aspect-[16/9]';
const ROOF_MEDIA_ASPECT_CLASS =
  'relative w-full shrink-0 overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9] xl:aspect-[21/9]';
const OVERLAY_ROW_CLASS =
  'absolute left-4 right-4 top-4 z-10 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const PRIMARY_CTA_LARGE_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white bg-white px-5 py-2.5 text-sm font-medium tracking-normal text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';
const SECONDARY_CTA_LARGE_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium tracking-normal text-white transition hover:border-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';

const SUBHEAD_COPY_CLASS = LEDE;
const BODY_COPY_CLASS = 'text-base leading-relaxed text-white/70';

const QUIET_LINK_CLASS =
  'text-sm font-medium text-white/70 underline underline-offset-4 decoration-white/35 transition hover:text-white hover:decoration-white';

function SelectionCheck({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/35 bg-black/60 ${className}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 text-white">
        <path
          d="M4 8.2l2.2 2.2L12 4.7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function labelForValue(options: ReadonlyArray<{ value: string; label: string }>, value?: string): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

function useCrossfadeMedia(media: MediaEntry, durationMs = 240) {
  const [current, setCurrent] = useState(media);
  const [previous, setPrevious] = useState<MediaEntry | null>(null);
  const [entered, setEntered] = useState(true);

  useEffect(() => {
    if (media.src === current.src && media.alt === current.alt) return;

    setPrevious(current);
    setCurrent(media);
    setEntered(false);

    const frameId = window.requestAnimationFrame(() => {
      setEntered(true);
    });
    const timeoutId = window.setTimeout(() => {
      setPrevious(null);
    }, durationMs + 24);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [current, durationMs, media.alt, media.src]);

  return { current, previous, entered };
}

function LocalProductNav({
  activeSection,
  onAnchorClick,
}: {
  activeSection: SectionId;
  onAnchorClick: (id: SectionId) => void;
}) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!overviewOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!overviewRef.current?.contains(event.target)) setOverviewOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverviewOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [overviewOpen]);

  return (
    <header className={ROOF_STRIP_CLASS}>
      <div className={SURFACE_CONTAINER_CLASS}>
        <div className={ROOF_STRIP_INNER_CLASS}>
          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden text-[11px] font-medium tracking-wide text-white/56 sm:block">Sanctuary Pergolas</p>
            <p className="truncate text-[13px] font-medium text-white">Pergola Design</p>
            <div ref={overviewRef} className="relative">
              <button
                type="button"
                aria-expanded={overviewOpen}
                aria-haspopup="menu"
                onClick={() => setOverviewOpen((previous) => !previous)}
                className="inline-flex items-center gap-1 text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Overview
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`h-4 w-4 transition-transform ${overviewOpen ? 'rotate-180' : ''}`}
                  fill="none"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {overviewOpen ? (
                <div
                  role="menu"
                  aria-label="Overview sections"
                  className="absolute left-0 top-[calc(100%+10px)] z-[70] w-[220px] rounded-2xl border border-white/10 bg-black/90 p-1.5 shadow-2xl"
                >
                  {NAV_ANCHORS.map((anchor) => {
                    const active = activeSection === anchor.id;
                    return (
                      <button
                        key={anchor.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onAnchorClick(anchor.id);
                          setOverviewOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          active
                            ? 'text-white underline decoration-white/60 underline-offset-4'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <span>{anchor.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className={ROOF_STRIP_RIGHT_CLASS}>
            <Link
              href="/start"
              className="hidden shrink-0 text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:inline-flex"
            >
              Start the guide
            </Link>
            <Link href="/contact" className={ROOF_STRIP_PRIMARY_CTA_CLASS}>
              Book a Design Consultation
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function OptionRailSelect({
  groupId,
  groupLabel,
  options,
  value,
  onChange,
  cardWidthClassName = SHELF_CARD,
  imageSizes = '(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px',
}: {
  groupId: string;
  groupLabel: string;
  options: ReadonlyArray<CardOption>;
  value?: string;
  onChange: (id: string) => void;
  cardWidthClassName?: string;
  imageSizes?: string;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return;

    const currentIndex = Math.max(0, options.findIndex((option) => option.id === value));
    const maxIndex = options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;

    if (nextIndex == null) return;

    event.preventDefault();
    const nextOption = options[nextIndex];
    onChange(nextOption.id);
    window.requestAnimationFrame(() => {
      itemRefs.current[nextIndex]?.focus();
      itemRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  };

  const selectedOption = options.find((option) => option.id === value) ?? null;

  return (
    <div className="space-y-3">
      <div
        id={groupId}
        tabIndex={-1}
        role="radiogroup"
        aria-label={groupLabel}
        onKeyDown={handleKeyDown}
        className={RAIL_SCROLL_OUTER_CLASS}
      >
        <div className={RAIL_TRACK_CLASS}>
          {options.map((option, index) => {
            const selected = option.id === value;
            return (
              <button
                key={option.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (!value && index === 0) ? 0 : -1}
                onClick={() => onChange(option.id)}
                className={`group relative snap-start overflow-hidden text-left transition duration-200 motion-reduce:transition-none ${cardWidthClassName} ${CARD_BASE} ${CARD_HOVER} ${CARD_FOCUS} ${
                  selected ? 'bg-white/[0.12] ring-white/35' : ''
                }`}
              >
                {selected ? <SelectionCheck className="absolute right-3 top-3 z-10" /> : null}
                {option.image ? (
                  <div className="relative aspect-[16/7] w-full overflow-hidden bg-white/5">
                    <Image src={option.image.src} alt={option.image.alt} fill sizes={imageSizes} className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3 pr-10">
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selectedOption?.description ? <p className="text-sm text-white/74">{selectedOption.description}</p> : null}
    </div>
  );
}

function OptionRailMulti({
  groupId,
  groupLabel,
  options,
  values,
  onToggle,
  cardWidthClassName = SHELF_CARD,
  imageSizes = '(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px',
}: {
  groupId: string;
  groupLabel: string;
  options: ReadonlyArray<CardOption>;
  values: ReadonlyArray<string>;
  onToggle: (id: string) => void;
  cardWidthClassName?: string;
  imageSizes?: string;
}) {
  const selectedSet = useMemo(() => new Set(values), [values]);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return;

    const currentIndex = Math.max(
      0,
      itemRefs.current.findIndex((item) => item === document.activeElement)
    );
    const maxIndex = options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;

    if (nextIndex == null) return;

    event.preventDefault();
    window.requestAnimationFrame(() => {
      itemRefs.current[nextIndex]?.focus();
      itemRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  };

  const selectedOptions = options.filter((option) => selectedSet.has(option.id));
  const multiCaption = selectedOptions.length
    ? selectedOptions.length === 1
      ? selectedOptions[0].description ?? null
      : `${selectedOptions.length} extras selected.`
    : 'Optional extras can elevate comfort, privacy, and year-round use.';

  return (
    <div className="space-y-3">
      <div
        id={groupId}
        tabIndex={-1}
        role="group"
        aria-label={groupLabel}
        onKeyDown={handleKeyDown}
        className={RAIL_SCROLL_OUTER_CLASS}
      >
        <div className={RAIL_TRACK_CLASS}>
          {options.map((option, index) => {
            const selected = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => onToggle(option.id)}
                className={`group relative snap-start overflow-hidden text-left transition duration-200 motion-reduce:transition-none ${cardWidthClassName} ${CARD_BASE} ${CARD_HOVER} ${CARD_FOCUS} ${
                  selected ? 'bg-white/[0.12] ring-white/35' : ''
                }`}
              >
                {selected ? <SelectionCheck className="absolute right-3 top-3 z-10" /> : null}
                {option.image ? (
                  <div className="relative aspect-[16/7] w-full overflow-hidden bg-white/5">
                    <Image src={option.image.src} alt={option.image.alt} fill sizes={imageSizes} className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3 pr-10">
                  <p className="text-sm font-semibold text-white">{option.title}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {multiCaption ? <p className="text-sm text-white/74">{multiCaption}</p> : null}
    </div>
  );
}

function EnclosureChipRow({
  groupId,
  groupLabel,
  value,
  onChange,
}: {
  groupId: string;
  groupLabel: string;
  value?: string;
  onChange: (id: string) => void;
}) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!ENCLOSURE_OPTIONS.length) return;

    const currentIndex = Math.max(0, ENCLOSURE_OPTIONS.findIndex((option) => option.id === value));
    const maxIndex = ENCLOSURE_OPTIONS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;

    if (nextIndex == null) return;

    event.preventDefault();
    const nextOption = ENCLOSURE_OPTIONS[nextIndex];
    onChange(nextOption.id);
    window.requestAnimationFrame(() => {
      itemRefs.current[nextIndex]?.focus();
      itemRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    });
  };

  return (
    <div
      id={groupId}
      tabIndex={-1}
      role="radiogroup"
      aria-label={groupLabel}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      {ENCLOSURE_OPTIONS.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!value && index === 0) ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              selected
                ? 'border-white/25 bg-white/[0.1] text-white'
                : 'border-white/20 bg-white/[0.03] text-white/76 hover:border-white/35 hover:text-white'
            }`}
          >
            {selected ? (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
            ) : (
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/30" aria-hidden="true" />
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilmModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(900px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/15 bg-black text-white shadow-2xl focus-visible:outline-none">
          <div className="relative aspect-[16/9] w-full bg-white/5">
            <Image src="/images/hero-2.jpg" alt="Film placeholder visual for Sanctuary pergolas." fill sizes="(max-width: 900px) 100vw, 900px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <Dialog.Close asChild>
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/45 px-3 py-1 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Close
              </button>
            </Dialog.Close>
          </div>
          <div className="space-y-3 p-5 md:p-6">
            <Dialog.Title className="text-2xl font-semibold tracking-tight">Watch the film</Dialog.Title>
            <Dialog.Description className="max-w-2xl text-sm leading-6 text-white/75">
              Placeholder modal for a product film. Swap this with your final video embed when assets are ready.
            </Dialog.Description>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviewSelectionsSheet({
  open,
  onOpenChange,
  rows,
  onChangeRow,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ReadonlyArray<ReviewRow>;
  onChangeRow: (row: ReviewRow) => void;
  onReset: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[100] max-h-[82vh] overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0a0a0a] p-4 text-white shadow-2xl focus-visible:outline-none md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px] md:rounded-3xl md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">Review selections</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-white/70">
                Your selections stay on this device.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full border border-white/35 px-3 py-1 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Close
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-2.5">
            {rows.length ? (
              rows.map((row) => (
                <div key={row.key} className="rounded-2xl border border-white/15 bg-white/[0.05] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] tracking-wide text-white/65">{row.label}</p>
                    <button
                      type="button"
                      onClick={() => onChangeRow(row)}
                      className="text-sm font-medium text-white underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm text-white">{row.value}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-sm text-white/70">
                No selections yet.
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-white/35 px-4 py-2 text-sm font-medium text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Reset
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full border border-white bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Done
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium tracking-wide">
            <Link
              href="/contact"
              className="text-white/76 underline decoration-white/35 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Book a Design Consultation
            </Link>
            <Link
              href="/start"
              className="text-white/62 underline decoration-white/30 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Start the guide
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function StartExploreClient() {
  const [selections, setSelections] = useState<StartExploreSelections>({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('hero');
  const [activeHighlightId, setActiveHighlightId] = useState(HIGHLIGHT_ITEMS[0]?.id ?? 'design');
  const [activePill, setActivePill] = useState<PillId>('path');
  const [activePerformanceTab, setActivePerformanceTab] = useState<PerformanceTabId>('wind');
  const [filmOpen, setFilmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const performanceTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSelections(readStartExploreSelections());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    writeStartExploreSelections(selections);
  }, [hasHydrated, selections]);

  useEffect(() => {
    if (!selections.extras?.length) return;
    const filteredExtras = selections.extras.filter((extraId) => !ENCLOSURE_EXTRA_IDS.has(extraId as ExtraId));
    if (filteredExtras.length === selections.extras.length) return;

    setSelections((previous) => {
      const current = previous.extras ?? [];
      const nextExtras = current.filter((extraId) => !ENCLOSURE_EXTRA_IDS.has(extraId as ExtraId));
      if (nextExtras.length === current.length) return previous;
      const next: StartExploreSelections = { ...previous };
      if (nextExtras.length) next.extras = nextExtras;
      else delete next.extras;
      return next;
    });
  }, [selections.extras]);

  useEffect(() => {
    const updateActiveSection = () => {
      const scrollOffset = 180;
      const marker = window.scrollY + scrollOffset;
      let current: SectionId = 'hero';

      for (const id of SECTION_IDS) {
        const node = document.getElementById(id);
        if (!node) continue;
        if (node.offsetTop <= marker) current = id;
      }

      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  const scrollToSection = useCallback((id: SectionId, focusId?: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (focusId) {
      window.setTimeout(() => {
        const focusNode = document.getElementById(focusId);
        if (focusNode instanceof HTMLElement) focusNode.focus({ preventScroll: true });
      }, 420);
    }
  }, []);

  const pathOptions = useMemo<CardOption[]>(
    () =>
      startFlowContent.branch.options.map((option) => ({
        id: option.value,
        title: option.label,
        description: option.description,
        image: BRANCH_MEDIA[option.value as EnquiryType],
      })),
    []
  );

  const roofStyleOptions = useMemo<CardOption[]>(
    () =>
      startFlowContent.roofStyle.options.map((option) => ({
        id: option.value,
        title: option.label,
        description: option.what,
        image: ROOF_STYLE_MEDIA[option.value as RoofStyle],
      })),
    []
  );

  const roofMaterialOptions = useMemo<CardOption[]>(
    () =>
      startFlowContent.roofMaterial.options.map((option) => ({
        id: option.value,
        title: option.label,
        description: option.description,
        image: ROOF_MATERIAL_MEDIA[option.value as RoofMaterialChoice],
      })),
    []
  );

  const extrasOptions = useMemo<CardOption[]>(
    () =>
      startFlowContent.extras.options
        .filter((option) => !ENCLOSURE_EXTRA_IDS.has(option.value))
        .map((option) => ({
          id: option.value,
          title: option.label,
          description: option.description,
          image: EXTRA_MEDIA[option.value as ExtraId],
        })),
    []
  );

  const roofSecondaryOptions = useMemo(
    () => getRoofSecondaryOptions(selections.roofMaterial),
    [selections.roofMaterial]
  );

  const selectedExtraIds = useMemo(
    () => (selections.extras ?? []).filter((extraId) => !ENCLOSURE_EXTRA_IDS.has(extraId as ExtraId)),
    [selections.extras]
  );

  const handlePathChange = useCallback((path: string) => {
    setSelections((previous) => ({ ...previous, path }));
  }, []);

  const handleRoofStyleChange = useCallback((roofStyle: string) => {
    setSelections((previous) => ({ ...previous, roofStyle }));
  }, []);

  const handleRoofMaterialChange = useCallback((roofMaterial: string) => {
    setSelections((previous) => {
      const next: StartExploreSelections = { ...previous, roofMaterial };
      const secondaryIds = new Set(getRoofSecondaryOptions(roofMaterial).map((option) => option.id));
      if (next.roofSecondary && !secondaryIds.has(next.roofSecondary)) {
        delete next.roofSecondary;
      }
      return next;
    });
  }, []);

  const handleRoofSecondaryChange = useCallback((roofSecondary: string) => {
    setSelections((previous) => ({ ...previous, roofSecondary }));
  }, []);

  const handleEnclosureChange = useCallback((enclosure: string) => {
    setSelections((previous) => ({ ...previous, enclosure }));
  }, []);

  const handleToggleExtra = useCallback((extraId: string) => {
    setSelections((previous) => {
      if (ENCLOSURE_EXTRA_IDS.has(extraId as ExtraId)) return previous;
      const nextExtras = new Set((previous.extras ?? []).filter((id) => !ENCLOSURE_EXTRA_IDS.has(id as ExtraId)));
      if (nextExtras.has(extraId)) nextExtras.delete(extraId);
      else nextExtras.add(extraId);

      const next: StartExploreSelections = { ...previous };
      delete next.extrasNone;

      if (nextExtras.size) next.extras = Array.from(nextExtras);
      else delete next.extras;

      return next;
    });
  }, []);

  const handleSetNoExtras = useCallback((enabled: boolean) => {
    setSelections((previous) => {
      const next: StartExploreSelections = { ...previous };
      if (enabled) {
        next.extrasNone = true;
        delete next.extras;
      } else {
        delete next.extrasNone;
      }
      return next;
    });
  }, []);

  const handleCompareStartPointChange = useCallback((compareStartPoint: string) => {
    setSelections((previous) => ({ ...previous, compareStartPoint }));
  }, []);

  const activeRoofStop = useMemo(() => {
    const exact = ROOF_STRIP_STOPS.find(
      (stop) => stop.roofMaterial === selections.roofMaterial && stop.roofSecondary === selections.roofSecondary
    );
    if (exact) return exact;
    const byMaterial = ROOF_STRIP_STOPS.find((stop) => stop.roofMaterial === selections.roofMaterial);
    return byMaterial ?? ROOF_STRIP_STOPS[0];
  }, [selections.roofMaterial, selections.roofSecondary]);

  const handleRoofStripChange = useCallback((stop: RoofStripStop) => {
    setSelections((previous) => ({
      ...previous,
      roofMaterial: stop.roofMaterial,
      roofSecondary: stop.roofSecondary,
    }));
  }, []);

  const handleReset = useCallback(() => {
    clearStartExploreSelections();
    setSelections({});
  }, []);

  const pathLabel = useMemo(
    () => labelForValue(startFlowContent.branch.options, selections.path),
    [selections.path]
  );

  const roofStyleLabel = useMemo(
    () => labelForValue(startFlowContent.roofStyle.options, selections.roofStyle),
    [selections.roofStyle]
  );

  const roofMaterialLabel = useMemo(
    () => labelForValue(startFlowContent.roofMaterial.options, selections.roofMaterial),
    [selections.roofMaterial]
  );

  const roofSecondaryLabel = useMemo(() => {
    if (!selections.roofSecondary) return null;
    return (
      getRoofSecondaryOptions(selections.roofMaterial).find((option) => option.id === selections.roofSecondary)?.label ??
      null
    );
  }, [selections.roofMaterial, selections.roofSecondary]);

  const enclosureLabel = useMemo(() => {
    if (!selections.enclosure) return null;
    return ENCLOSURE_OPTIONS.find((option) => option.id === selections.enclosure)?.label ?? null;
  }, [selections.enclosure]);

  const extrasLabel = useMemo(() => {
    if (selections.extrasNone) return startFlowContent.extras.noneLabel;
    if (!selectedExtraIds.length) return null;
    return selectedExtraIds
      .map((extraId) => startFlowContent.extras.options.find((option) => option.value === extraId)?.label ?? extraId)
      .join(', ');
  }, [selections.extrasNone, selectedExtraIds]);

  const compareLabel = useMemo(() => {
    if (!selections.compareStartPoint) return null;
    return (
      COMPARE_START_POINT_OPTIONS.find((option) => option.id === selections.compareStartPoint)?.label ?? null
    );
  }, [selections.compareStartPoint]);

  const reviewRows = useMemo<ReviewRow[]>(() => {
    const rows: ReviewRow[] = [];

    if (pathLabel) {
      rows.push({
        key: 'path',
        label: 'Path',
        value: pathLabel,
        anchor: 'design',
        focusId: 'explore-path-group',
      });
    }

    if (roofStyleLabel) {
      rows.push({
        key: 'roofStyle',
        label: 'Roof style',
        value: roofStyleLabel,
        anchor: 'roof',
        focusId: 'explore-roof-style-group',
      });
    }

    if (roofMaterialLabel) {
      rows.push({
        key: 'roofMaterial',
        label: 'Roof material',
        value: roofSecondaryLabel ? `${roofMaterialLabel} (${roofSecondaryLabel})` : roofMaterialLabel,
        anchor: 'roof',
        focusId: 'explore-roof-material-group',
      });
    }

    if (enclosureLabel) {
      rows.push({
        key: 'enclosure',
        label: 'Enclosure/screens',
        value: enclosureLabel,
        anchor: 'shared',
        focusId: 'explore-enclosure-group',
      });
    }

    if (extrasLabel) {
      rows.push({
        key: 'extras',
        label: 'Extras',
        value: extrasLabel,
        anchor: 'extras',
        focusId: 'explore-extras-group',
      });
    }

    if (compareLabel) {
      rows.push({
        key: 'compare',
        label: 'Compare start point',
        value: compareLabel,
        anchor: 'compare',
        focusId: 'explore-compare-group',
      });
    }

    return rows;
  }, [compareLabel, enclosureLabel, extrasLabel, pathLabel, roofMaterialLabel, roofSecondaryLabel, roofStyleLabel]);

  const activeCompareOutcomes = useMemo(() => {
    if (!selections.compareStartPoint) return null;
    return COMPARE_OUTCOMES[selections.compareStartPoint] ?? null;
  }, [selections.compareStartPoint]);

  const highlightSavedState = useMemo(
    () => ({
      design: Boolean(selections.path || selections.roofStyle || selections.roofMaterial),
      roof: Boolean(selections.roofStyle || selections.roofMaterial),
      shared: Boolean(selections.enclosure),
      extras: Boolean(selections.extrasNone || selectedExtraIds.length),
      compare: Boolean(selections.compareStartPoint),
    }),
    [
      selections.compareStartPoint,
      selections.enclosure,
      selections.extrasNone,
      selections.path,
      selections.roofMaterial,
      selections.roofStyle,
      selectedExtraIds.length,
    ]
  );

  const activeHighlight = useMemo<HighlightShelfItem>(
    () => HIGHLIGHT_ITEMS.find((item) => item.id === activeHighlightId) ?? HIGHLIGHT_ITEMS[0]!,
    [activeHighlightId]
  );

  const activeHighlightSaved = activeHighlight?.savedState ? highlightSavedState[activeHighlight.savedState] : false;

  const pillSavedState = useMemo<Record<PillId, boolean>>(
    () => ({
      path: Boolean(selections.path),
      roofStyle: Boolean(selections.roofStyle),
      roofMaterial: Boolean(selections.roofMaterial),
      extras: Boolean(selections.extrasNone || selectedExtraIds.length),
      consent: false,
      process: false,
    }),
    [selections.extrasNone, selections.path, selections.roofMaterial, selections.roofStyle, selectedExtraIds.length]
  );

  const activeDesignVisual = useMemo(() => {
    if (activePill === 'path') {
      const option = pathOptions.find((item) => item.id === selections.path) ?? pathOptions[0];
      return {
        image: option?.image ?? BRANCH_MEDIA.residential,
        title: option?.title ?? 'Path',
        caption: option?.description ?? 'Path choice aligns recommendations with your project goals.',
      };
    }

    if (activePill === 'roofStyle') {
      const option = roofStyleOptions.find((item) => item.id === selections.roofStyle) ?? roofStyleOptions[0];
      return {
        image: option?.image ?? ROOF_STYLE_MEDIA.pitched,
        title: option?.title ?? 'Roof style',
        caption: option?.description ?? 'Roof geometry defines shelter character and overall silhouette.',
      };
    }

    if (activePill === 'roofMaterial') {
      const option = roofMaterialOptions.find((item) => item.id === selections.roofMaterial) ?? roofMaterialOptions[0];
      return {
        image: option?.image ?? ROOF_MATERIAL_MEDIA.acrylic,
        title: option?.title ?? 'Roof material',
        caption: option?.description ?? 'Material choice tunes daylight, shade, and thermal comfort.',
      };
    }

    if (activePill === 'extras') {
      const option = extrasOptions.find((item) => selectedExtraIds.includes(item.id)) ?? extrasOptions[0];
      return {
        image: option?.image ?? EXTRA_MEDIA.blinds,
        title: option?.title ?? 'Extras',
        caption: option?.description ?? 'Add functionality that supports year-round use.',
      };
    }

    if (activePill === 'consent') {
      return {
        image: { src: '/images/project-kiwi-rail-02.jpg', alt: 'Construction detail and compliance-focused pergola installation.' },
        title: 'Consent basics',
        caption: 'Quick guidance only. Final requirements depend on council interpretation and site context.',
      };
    }

    return {
      image: { src: '/images/project-velskov-01.jpg', alt: 'Pergola consultation timeline visual.' },
      title: 'What happens next',
      caption: 'Your shortlist feeds into a Design Consultation and coordinated build pathway.',
    };
  }, [
    activePill,
    extrasOptions,
    pathOptions,
    roofMaterialOptions,
    roofStyleOptions,
    selections.path,
    selections.roofMaterial,
    selections.roofStyle,
    selectedExtraIds,
  ]);

  const handleReviewRowChange = useCallback(
    (row: ReviewRow) => {
      if (row.key === 'path') setActivePill('path');
      setReviewOpen(false);
      scrollToSection(row.anchor, row.focusId);
    },
    [scrollToSection]
  );

  const handlePerformanceTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const tabOrder = PERFORMANCE_TABS.map((tab) => tab.id);
      const currentIndex = Math.max(0, tabOrder.indexOf(activePerformanceTab));
      const lastIndex = tabOrder.length - 1;
      let nextIndex: number | null = null;

      if (event.key === 'ArrowRight') nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1;
      if (event.key === 'ArrowLeft') nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = lastIndex;

      if (nextIndex == null) return;

      event.preventDefault();
      const nextTab = tabOrder[nextIndex];
      setActivePerformanceTab(nextTab);
      window.requestAnimationFrame(() => {
        performanceTabRefs.current[nextIndex]?.focus();
      });
    },
    [activePerformanceTab]
  );

  const activePerformance = PERFORMANCE_TABS.find((tab) => tab.id === activePerformanceTab) ?? PERFORMANCE_TABS[0];
  const designVisualCrossfade = useCrossfadeMedia(activeDesignVisual.image);
  const roofVisualCrossfade = useCrossfadeMedia(activeRoofStop.image);

  return (
    <div className="start-explore-page min-h-screen text-white">
      <LocalProductNav activeSection={activeSection} onAnchorClick={scrollToSection} />

      <main>
        <section id="hero" className="relative min-h-[84vh] max-h-[920px] overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/hero-1.jpg"
              alt="Sanctuary pergola installed over an outdoor entertaining area."
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.18),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.68)_78%)]" />
          </div>
          <div className={`${SHELL} relative flex min-h-[84vh] max-h-[920px] items-end pb-12 pt-24 md:pb-16`}>
            <div className={`${GRID_2COL} w-full items-end`}>
              <div className={COL_COPY}>
                <div className={COPY_RAIL}>
                  <p className={KICKER}>Sanctuary Pergolas</p>
                  <h1 className={`mt-3 ${H1}`}>A pergola that feels built-in.</h1>
                  <p className={SUBHEAD_COPY_CLASS}>Calm shelter, tuned light, and detailing that feels integral to your home.</p>
                  <div className="mt-6 flex flex-wrap items-center gap-5">
                    <button
                      type="button"
                      onClick={() => scrollToSection('highlights')}
                      className={QUIET_LINK_CLASS}
                    >
                      Explore highlights
                    </button>
                    <Link href="/start" className={QUIET_LINK_CLASS}>
                      Start the guide
                    </Link>
                  </div>
                </div>
              </div>
              <div className={`${COL_MEDIA} hidden xl:block`} aria-hidden="true" />
            </div>
          </div>
        </section>

        <section id="highlights" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className={COPY_RAIL}>
                <p className={KICKER}>Overview</p>
                <h2 className={`mt-2 ${H2}`}>Get the highlights.</h2>
              </div>
              <button
                type="button"
                onClick={() => setFilmOpen(true)}
                className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Watch the film
              </button>
            </div>

            <div className={SECTION_GAP}>
              <div className={MODULE_SURFACE}>
                <div className={`${MODULE_INNER} ${MODULE_DIVIDE}`}>
                  <div className="p-4 sm:p-6 xl:p-8">
                    <div className={SHELF_ROW}>
                      {HIGHLIGHT_ITEMS.map((item) => {
                        const active = item.id === activeHighlight.id;
                        const saved = item.savedState ? highlightSavedState[item.savedState] : false;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveHighlightId(item.id)}
                            className={`group relative aspect-[16/7] snap-start overflow-hidden text-left transition duration-200 motion-reduce:transition-none ${SHELF_CARD} ${CARD_BASE} ${CARD_HOVER} ${CARD_FOCUS} ${
                              active ? 'bg-white/[0.12] ring-white/35' : ''
                            }`}
                          >
                            {saved ? <SelectionCheck className="absolute right-3 top-3 z-10" /> : null}
                            <Image
                              src={item.image}
                              alt={`${item.title} chapter preview`}
                              fill
                              sizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/12 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                              <p className={H3}>{item.title}</p>
                              <p className="text-sm text-white/72">{item.subtitle}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 xl:p-8">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-[760px] space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className={H3}>{activeHighlight.title}</h3>
                          {activeHighlightSaved ? <SelectionCheck /> : null}
                        </div>
                        <ul className="space-y-2 text-sm leading-6 text-white/70">
                          {activeHighlight.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2">
                              <span className="pt-1 text-white/65" aria-hidden="true">
                                *
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => scrollToSection(activeHighlight.chapterId)}
                          className={QUIET_LINK_CLASS}
                        >
                          Learn more
                        </button>
                        <Link href="/start" className={QUIET_LINK_CLASS}>
                          Start the guide
                        </Link>
                      </div>
                    </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="design" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Design chapter</p>
              <h2 className={`mt-2 ${H2}`}>Take a closer look.</h2>
              <p className={`mt-4 ${BODY_COPY_CLASS}`}>Shape the brief and keep a clear shortlist as you compare options.</p>
            </div>

            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} overflow-hidden`}>
                <div className={`grid min-h-0 grid-cols-1 ${TAKE_LOOK_GRID_LG_CLASS}`}>
                  <div className="p-4 sm:p-6 lg:border-r lg:border-border/10 lg:p-8">
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-y-auto lg:pb-0 lg:pr-1">
                      {PILL_ORDER.map((pill) => {
                        const active = pill.id === activePill;
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() => setActivePill(pill.id)}
                            className={`shrink-0 rounded-full border px-4 py-2.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:w-full ${
                              active
                                ? 'border-white/25 bg-white/[0.1] text-white'
                                : 'border-white/20 bg-white/[0.03] text-white/78 hover:border-white/35 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium">{pill.label}</span>
                              {pillSavedState[pill.id] ? <SelectionCheck className="h-4 w-4 border-white/25 bg-white/10" /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-w-0 border-t border-white/10 lg:border-t-0">
                    <div className="flex min-h-0 flex-col">
                      <div className={TAKE_LOOK_MEDIA_ASPECT_CLASS}>
                        {designVisualCrossfade.previous ? (
                          <Image
                            src={designVisualCrossfade.previous.src}
                            alt=""
                            aria-hidden="true"
                            fill
                            sizes="(max-width: 1024px) 100vw, 70vw"
                            className={`object-cover transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
                              designVisualCrossfade.entered ? 'opacity-0' : 'opacity-100'
                            }`}
                          />
                        ) : null}
                        <Image
                          src={designVisualCrossfade.current.src}
                          alt={designVisualCrossfade.current.alt}
                          fill
                          sizes="(max-width: 1024px) 100vw, 70vw"
                          className={`object-cover transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
                            designVisualCrossfade.previous
                              ? designVisualCrossfade.entered
                                ? 'opacity-100'
                                : 'opacity-0'
                              : 'opacity-100'
                          }`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                          <p className="text-xl font-semibold">{activeDesignVisual.title}</p>
                          <p className="mt-1 max-w-[760px] text-sm text-white/72">{activeDesignVisual.caption}</p>
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 p-4 sm:p-6 lg:p-8">
                        <div className="min-h-0 h-full overflow-y-auto pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {activePill === 'path' ? (
                            <OptionRailSelect
                              groupId="explore-path-group"
                              groupLabel="Choose your path"
                              options={pathOptions}
                              value={selections.path}
                              onChange={handlePathChange}
                              cardWidthClassName={SHELF_CARD}
                              imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                            />
                          ) : null}

                          {activePill === 'roofStyle' ? (
                            <OptionRailSelect
                              groupId="design-roof-style-group"
                              groupLabel="Choose roof style"
                              options={roofStyleOptions}
                              value={selections.roofStyle}
                              onChange={handleRoofStyleChange}
                              cardWidthClassName={SHELF_CARD}
                              imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                            />
                          ) : null}

                          {activePill === 'roofMaterial' ? (
                            <div className="space-y-4">
                              <OptionRailSelect
                                groupId="design-roof-material-group"
                                groupLabel="Choose roof material"
                                options={roofMaterialOptions}
                                value={selections.roofMaterial}
                                onChange={handleRoofMaterialChange}
                                cardWidthClassName={SHELF_CARD}
                                imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                              />
                              {roofSecondaryOptions.length ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-white/62">Material detail</p>
                                  <div
                                    role="radiogroup"
                                    aria-label="Choose roof material secondary option"
                                    className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                  >
                                    {roofSecondaryOptions.map((option) => {
                                      const selected = option.id === selections.roofSecondary;
                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          role="radio"
                                          aria-checked={selected}
                                          onClick={() => handleRoofSecondaryChange(option.id)}
                                          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                            selected
                                              ? 'border-white/25 bg-white/[0.1] text-white'
                                              : 'border-white/20 bg-white/[0.03] text-white/75 hover:border-white/35 hover:text-white'
                                          }`}
                                        >
                                          {option.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {activePill === 'extras' ? (
                            <div className="space-y-4">
                              <OptionRailMulti
                                groupId="design-extras-group"
                                groupLabel="Choose extras"
                                options={extrasOptions}
                                values={selectedExtraIds}
                                onToggle={handleToggleExtra}
                                cardWidthClassName={SHELF_CARD}
                                imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                              />
                              <button
                                type="button"
                                aria-pressed={Boolean(selections.extrasNone)}
                                onClick={() => handleSetNoExtras(!selections.extrasNone)}
                                className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                  selections.extrasNone
                                    ? 'border-white/25 bg-white/[0.1] text-white'
                                    : 'border-white/20 bg-white/[0.03] text-white/75 hover:border-white/35 hover:text-white'
                                }`}
                              >
                                {startFlowContent.extras.noneLabel}
                              </button>
                            </div>
                          ) : null}

                          {activePill === 'consent' ? (
                            <div className="space-y-4 rounded-2xl bg-white/[0.02] p-4">
                              <p className={`text-sm ${BODY_COPY_CLASS}`}>{startFlowContent.consent.disclaimer}</p>
                              <ul className="space-y-2">
                                {startFlowContent.consent.links.map((link) => (
                                  <li key={link.href}>
                                    <a
                                      href={link.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sm text-white/80 underline underline-offset-4 decoration-white/35 transition hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    >
                                      {link.label}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {activePill === 'process' ? (
                            <div className="rounded-2xl bg-white/[0.02] p-4">
                              <ol className="space-y-2.5">
                                {startFlowContent.process.timeline.map((step, index) => (
                                  <li key={step} className="flex items-center gap-3 text-sm text-white/78">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[11px] text-white/80">
                                      {index + 1}
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="roof" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Roof chapter</p>
              <h2 className={`mt-2 ${H2}`}>Dial in roof and light behavior.</h2>
              <p className={`mt-4 ${BODY_COPY_CLASS}`}>Compare roof material intent and light behavior in one place.</p>
            </div>

            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} overflow-hidden`}>
                <div className="flex min-h-0 flex-col">
                  <div className={ROOF_MEDIA_ASPECT_CLASS}>
                    <div className={OVERLAY_ROW_CLASS}>
                      {ROOF_STRIP_STOPS.map((stop) => {
                        const selected = stop.id === activeRoofStop.id;
                        return (
                          <button
                            key={stop.id}
                            type="button"
                            onClick={() => handleRoofStripChange(stop)}
                            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                              selected
                                ? 'border-white/25 bg-white/[0.12] text-white'
                                : 'border-white/20 bg-black/45 text-white/85 hover:border-white/35 hover:text-white'
                            }`}
                          >
                            {stop.label}
                          </button>
                        );
                      })}
                    </div>
                    {roofVisualCrossfade.previous ? (
                      <Image
                        src={roofVisualCrossfade.previous.src}
                        alt=""
                        aria-hidden="true"
                        fill
                        sizes="(max-width: 1024px) 100vw, 80vw"
                        className={`object-cover transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
                          roofVisualCrossfade.entered ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                    ) : null}
                    <Image
                      src={roofVisualCrossfade.current.src}
                      alt={roofVisualCrossfade.current.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 80vw"
                      className={`object-cover transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
                        roofVisualCrossfade.previous
                          ? roofVisualCrossfade.entered
                            ? 'opacity-100'
                            : 'opacity-0'
                          : 'opacity-100'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                      <p className={H3}>{activeRoofStop.label}</p>
                      <p className="mt-1 text-sm text-white/72">{activeRoofStop.caption}</p>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="grid min-h-0 gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid-cols-2">
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-white/62">Roof style</p>
                        <OptionRailSelect
                          groupId="explore-roof-style-group"
                          groupLabel="Choose roof style"
                          options={roofStyleOptions}
                          value={selections.roofStyle}
                          onChange={handleRoofStyleChange}
                          cardWidthClassName={SHELF_CARD}
                          imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                        />
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-white/62">Roof material</p>
                        <OptionRailSelect
                          groupId="explore-roof-material-group"
                          groupLabel="Choose roof material"
                          options={roofMaterialOptions}
                          value={selections.roofMaterial}
                          onChange={handleRoofMaterialChange}
                          cardWidthClassName={SHELF_CARD}
                          imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                        />
                        {roofSecondaryOptions.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-white/62">Material detail</p>
                            <div
                              role="radiogroup"
                              aria-label="Choose roof material secondary option"
                              className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            >
                              {roofSecondaryOptions.map((option) => {
                                const selected = option.id === selections.roofSecondary;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => handleRoofSecondaryChange(option.id)}
                                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                      selected
                                        ? 'border-white/25 bg-white/[0.1] text-white'
                                        : 'border-white/20 bg-white/[0.03] text-white/75 hover:border-white/35 hover:text-white'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-4">
                      <button type="button" onClick={() => scrollToSection('performance')} className={QUIET_LINK_CLASS}>
                        Learn more about performance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="performance" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Performance</p>
              <h2 className={`mt-2 ${H2}`}>Built for NZ conditions.</h2>
              <p className={`mt-4 ${BODY_COPY_CLASS}`}>Each lens shows how your choices influence daily comfort and reliability.</p>
            </div>

            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} overflow-hidden`}>
                <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
                  <div
                    role="tablist"
                    aria-label="Performance tabs"
                    onKeyDown={handlePerformanceTabKeyDown}
                    className="flex flex-wrap gap-2"
                  >
                    {PERFORMANCE_TABS.map((tab, index) => {
                      const selected = tab.id === activePerformanceTab;
                      return (
                        <button
                          key={tab.id}
                          id={`perf-tab-${tab.id}`}
                          ref={(node) => {
                            performanceTabRefs.current[index] = node;
                          }}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          aria-controls={`perf-panel-${tab.id}`}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => setActivePerformanceTab(tab.id)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            selected
                              ? 'border-white/25 bg-white/[0.1] text-white'
                              : 'border-white/20 bg-white/[0.03] text-white/75 hover:border-white/35 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  id={`perf-panel-${activePerformance.id}`}
                  role="tabpanel"
                  aria-labelledby={`perf-tab-${activePerformance.id}`}
                  className="grid grid-cols-12 items-stretch gap-4 px-4 pb-4 pt-5 sm:gap-5 sm:px-6 sm:pb-6 lg:gap-6 lg:px-8 lg:pb-8"
                >
                  <div className="col-span-12 lg:col-span-7">
                    <div className="relative w-full aspect-[16/10] overflow-hidden rounded-2xl">
                      <Image
                        src={activePerformance.image.src}
                        alt={activePerformance.image.alt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    </div>
                  </div>
                  <div className="col-span-12 flex h-full lg:col-span-5 lg:border-l lg:border-white/10 lg:pl-6">
                    <div className="my-auto max-w-[48ch] space-y-4">
                      <h3 className={H3}>{activePerformance.title}</h3>
                      <ul className="space-y-2.5 text-sm leading-6 text-white/70">
                        {activePerformance.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <span className="pt-1 text-white/65" aria-hidden="true">
                              *
                            </span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="shared" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Shared baseline</p>
              <h2 className={`mt-2 ${H2}`}>What every project includes.</h2>
            </div>

            <div className={SECTION_GAP}>
              <div className={MODULE_SURFACE}>
                <div className={`${MODULE_INNER} ${MODULE_DIVIDE}`}>
                  <div className="p-4 sm:p-6 xl:p-8">
                    <div className={SHELF_ROW}>
                      {SHARED_FEATURES.map((feature) => (
                        <article key={feature.title} className={`${SHELF_CARD} snap-start ${CARD_BASE} p-4`}>
                          <h3 className={H3}>{feature.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-white/70">{feature.body}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 xl:p-8">
                    <p className="text-xs font-medium text-white/62">How enclosed should it feel?</p>
                    <div className="mt-3">
                      <EnclosureChipRow
                        groupId="explore-enclosure-group"
                        groupLabel="Choose enclosure preference"
                        value={selections.enclosure}
                        onChange={handleEnclosureChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="extras" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Extras</p>
              <h2 className={`mt-2 ${H2}`}>Personalize your everyday use.</h2>
            </div>

            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} p-4 sm:p-6 xl:p-8`}>
                <OptionRailMulti
                  groupId="explore-extras-group"
                  groupLabel="Choose extras"
                  options={extrasOptions}
                  values={selectedExtraIds}
                  onToggle={handleToggleExtra}
                  cardWidthClassName={SHELF_CARD}
                  imageSizes="(max-width: 768px) 80vw, (max-width: 1536px) 360px, 400px"
                />
                <button
                  type="button"
                  aria-pressed={Boolean(selections.extrasNone)}
                  onClick={() => handleSetNoExtras(!selections.extrasNone)}
                  className={`mt-4 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    selections.extrasNone
                      ? 'border-white/25 bg-white/[0.1] text-white'
                      : 'border-white/20 bg-white/[0.03] text-white/75 hover:border-white/35 hover:text-white'
                  }`}
                >
                  {startFlowContent.extras.noneLabel}
                </button>

                <div className="mt-5 border-t border-white/10 pt-4">
                  <button type="button" onClick={() => scrollToSection('compare')} className={QUIET_LINK_CLASS}>
                    Learn more in Compare
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="compare" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={COPY_RAIL}>
              <p className={KICKER}>Worth it?</p>
              <h2 className={`mt-2 ${H2}`}>What are you starting with?</h2>
            </div>

            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} p-4 sm:p-6 xl:p-8 lg:h-[420px]`}>
                <div className="grid h-full gap-5 xl:gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div
                  id="explore-compare-group"
                  tabIndex={-1}
                  role="radiogroup"
                  aria-label="Choose what you are starting with"
                  className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0"
                >
                  {COMPARE_START_POINT_OPTIONS.map((option) => {
                    const selected = option.id === selections.compareStartPoint;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleCompareStartPointChange(option.id)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:rounded-2xl lg:py-3 ${
                          selected
                            ? 'border-white/25 bg-white/[0.1] text-white'
                            : 'border-white/20 bg-white/[0.03] text-white/78 hover:border-white/35 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <button type="button" onClick={() => scrollToSection('cta')} className={QUIET_LINK_CLASS}>
                    Continue to summary
                  </button>
                </div>
              </div>

                  <div className="rounded-2xl bg-black/35 ring-1 ring-white/10 p-4">
                <p className="text-xs font-medium text-white/62">What changes</p>
                {activeCompareOutcomes ? (
                  <ul className="mt-2.5 space-y-2.5 text-sm text-white/70">
                    {activeCompareOutcomes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="pt-1 text-white/65" aria-hidden="true">
                          *
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-sm text-white/68">Each starting point reveals likely gains in comfort and usability.</p>
                )}
              </div>
            </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className={SECTION_CONTAINER_CLASS}>
          <div className={SURFACE_CONTAINER_CLASS}>
            <div className={SECTION_GAP}>
              <div className={`${MODULE_SURFACE} p-6 md:p-10 lg:max-h-[420px] lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                <div className={COPY_RAIL}>
                  <h2 className={H2}>Ready to talk through your space?</h2>
                  <p className={`mt-4 ${BODY_COPY_CLASS}`}>Book a Design Consultation. Your saved preferences carry through.</p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/contact" className={PRIMARY_CTA_LARGE_CLASS}>
                    Book a Design Consultation
                  </Link>
                  <Link href="/start" className={SECONDARY_CTA_LARGE_CLASS}>
                    Start the guide
                  </Link>
                </div>

                {reviewRows.length ? (
                  <div className="mt-6 rounded-2xl bg-black/35 ring-1 ring-white/10 p-4">
                    <p className="text-xs font-medium text-white/62">Saved selections</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {reviewRows.map((row) => (
                        <p key={`cta-${row.key}`} className="text-sm text-white/78">
                          <span className="text-white/62">{row.label}:</span> {row.value}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={() => setReviewOpen(true)}
        className="fixed bottom-6 right-6 z-[60] hidden rounded-full border border-white/35 bg-black/65 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:border-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
      >
        Review selections {reviewRows.length ? `(${reviewRows.length})` : ''}
      </button>

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/15 bg-black/85 p-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="flex w-full items-center justify-between rounded-full border border-white/35 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>Review</span>
          <span className="text-xs tracking-wide text-white/75">
            {reviewRows.length ? `${reviewRows.length} saved` : 'No selections'}
          </span>
        </button>
      </div>

      <FilmModal open={filmOpen} onOpenChange={setFilmOpen} />
      <ReviewSelectionsSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        rows={reviewRows}
        onChangeRow={handleReviewRowChange}
        onReset={handleReset}
      />

      <style jsx global>{`
        .start-explore-page {
          background:
            radial-gradient(circle at 20% -5%, rgba(255, 255, 255, 0.18), transparent 34%),
            radial-gradient(circle at 85% 0%, rgba(255, 255, 255, 0.12), transparent 30%),
            #030303;
        }

        .start-explore-page :where(button, a, [role='radio'], [role='tab'], [role='checkbox']):focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.95);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .start-explore-page *,
          .start-explore-page *::before,
          .start-explore-page *::after {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
