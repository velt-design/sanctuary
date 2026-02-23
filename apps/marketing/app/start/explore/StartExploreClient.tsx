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
  getRoofSecondaryOptions,
  readStartExploreSelections,
  type StartExploreSelections,
  writeStartExploreSelections,
} from './startExploreStore';

type SectionId = 'hero' | 'highlights' | 'design' | 'roof' | 'performance' | 'shared' | 'extras' | 'compare' | 'cta';
type PillId = 'path' | 'roofStyle' | 'roofMaterial' | 'enclosure' | 'extras' | 'consent' | 'process';
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
  { id: 'enclosure', label: 'Screens/enclosure' },
  { id: 'extras', label: 'Extras' },
  { id: 'consent', label: 'Consent basics' },
  { id: 'process', label: 'What happens next' },
];

const ENCLOSURE_EXTRA_IDS = new Set<ExtraId>(['blinds', 'slats', 'acrylic_infills']);

const SHARED_FEATURES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Engineered for NZ sites',
    body: 'Site-specific spans, fixings, and detailing to suit local wind and exposure conditions.',
  },
  {
    title: 'Precision fabrication',
    body: 'Factory-cut aluminium members with controlled tolerances for cleaner installs and long-term fit.',
  },
  {
    title: 'Drainage strategy',
    body: 'Gutters, falls, and outlet points planned early so roof performance stays predictable in heavy rain.',
  },
  {
    title: 'Low-maintenance materials',
    body: 'Powder-coated aluminium and durable roof systems chosen for coastal resilience and simple upkeep.',
  },
  {
    title: 'Lighting-ready pathways',
    body: 'Provision planning for downlights, strips, and switching so upgrades are straightforward.',
  },
  {
    title: 'Design Consultation workflow',
    body: 'Clear recommendation path from concept to build with support for residential and commercial briefs.',
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
      'Roof style and spans are chosen to suit site exposure and wind direction.',
      'Connections and post layouts are coordinated for long-term structural stability.',
      'Optional screens and enclosures are planned to avoid unintended wind loads.',
    ],
  },
  {
    id: 'rain',
    label: 'Rain',
    title: 'Drainage strategy is set with the roof concept.',
    image: { src: '/images/project-asquith-ave-01.jpg', alt: 'Pergola roof line with integrated drainage path.' },
    bullets: [
      'Roof fall and outlet direction are selected early to manage runoff cleanly.',
      'Perimeter and flashing details are tuned to keep junctions dry.',
      'Material pairings preserve weather protection while maintaining daylight.',
    ],
  },
  {
    id: 'heat',
    label: 'Heat/Glare',
    title: 'Light and comfort are balanced by material selection.',
    image: { src: '/images/product-pitched-04.jpg', alt: 'Acrylic roof tint controlling glare in bright sunlight.' },
    bullets: [
      'Acrylic, timber, and combination roofs tune brightness and shade by zone.',
      'Secondary roof options help target glare control where it matters most.',
      'Extras like blinds and infills can add weather control without closing the space.',
    ],
  },
  {
    id: 'comfort',
    label: 'Noise/Comfort',
    title: 'Daily usability is considered beyond pure shelter.',
    image: { src: '/images/project-goodhome-04.jpg', alt: 'Lit pergola at dusk showing comfort-focused extras.' },
    bullets: [
      'Lighting, screens, and heaters are planned as integrated options.',
      'Roof detailing and enclosure choices support quieter, more stable use in weather.',
      'Consultation outcomes focus on year-round comfort for your specific use case.',
    ],
  },
];

const COMPARE_OUTCOMES: Record<string, readonly string[]> = {
  no_cover: [
    'Rain protection expands usable days across the year.',
    'Defined shelter supports outdoor dining and evening use.',
    'Material and lighting choices make the space feel intentional.',
    'The transition from indoors to outdoors feels more integrated.',
  ],
  old_pergola: [
    'New structural geometry can improve drainage and usable head height.',
    'Modern roof systems tune light, heat, and shelter more precisely.',
    'Optional extras add privacy, weather control, and night-time usability.',
    'A refreshed silhouette can better match current architecture.',
  ],
  umbrella_or_shade_sail: [
    'Permanent structure adds predictable weather cover and durability.',
    'Engineered posts and roof lines reduce setup and pack-down friction.',
    'Integrated lighting and enclosure options expand after-dark use.',
    'The space reads as a built-in outdoor room rather than temporary shade.',
  ],
  not_sure: [
    'Path selection clarifies whether the brief is residential, commercial, or professional.',
    'Roof style and material pairings quickly narrow your likely best fit.',
    'Saved selections keep choices consistent while you review sections.',
    'A Design Consultation turns your shortlist into a buildable direction.',
  ],
};

const ROOF_STRIP_STOPS: ReadonlyArray<RoofStripStop> = [
  {
    id: 'acrylic-clear',
    label: 'Acrylic clear',
    caption: 'High daylight feel with clear acrylic behavior.',
    roofMaterial: 'acrylic',
    roofSecondary: 'clear',
    image: ACRYLIC_TINT_MEDIA.clear,
  },
  {
    id: 'acrylic-opal',
    label: 'Acrylic opal',
    caption: 'Softer, diffused light for glare control.',
    roofMaterial: 'acrylic',
    roofSecondary: 'opal',
    image: ACRYLIC_TINT_MEDIA.opal,
  },
  {
    id: 'timber-natural',
    label: 'Timber natural',
    caption: 'Warmer ceiling expression with timber finish intent.',
    roofMaterial: 'timber',
    roofSecondary: 'natural',
    image: TIMBER_FINISH_MEDIA.natural,
  },
  {
    id: 'combo-circulation',
    label: 'Combo circulation',
    caption: 'Combination roof with daylight focused over movement zones.',
    roofMaterial: 'combination',
    roofSecondary: 'circulation',
    image: ROOF_MATERIAL_MEDIA.combination,
  },
  {
    id: 'combo-seating',
    label: 'Combo seating',
    caption: 'Combination roof with daylight focused over seating zones.',
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
    bullets: ['Set your project path first to tune recommendations.', 'Save choices as you compare roof style and materials.'],
    chapterId: 'design',
    image: '/images/project-westmere-01.jpg',
    savedState: 'design',
  },
  {
    id: 'roof',
    title: 'Roof and light',
    subtitle: 'Interactive strip for material and light behavior.',
    bullets: ['Tap roof strip stops to update material behavior instantly.', 'Compare roof style and roof material rails side-by-side.'],
    chapterId: 'roof',
    image: '/images/product-pitched-03.jpg',
    savedState: 'roof',
  },
  {
    id: 'performance',
    title: 'Performance',
    subtitle: 'Wind, rain, heat, and comfort chapter.',
    bullets: ['Switch tabs for each performance lens.', 'Review quick bullet outcomes without leaving the chapter.'],
    chapterId: 'performance',
    image: '/images/project-kiwi-rail-02.jpg',
  },
  {
    id: 'shared',
    title: 'Shared',
    subtitle: 'What every Sanctuary project includes.',
    bullets: ['Browse baseline features in a horizontal shelf.', 'Set enclosure preference if you want to refine shelter feel.'],
    chapterId: 'shared',
    image: '/images/project-atelier-shu-01.jpg',
    savedState: 'shared',
  },
  {
    id: 'extras',
    title: 'Extras',
    subtitle: 'Lighting, screens, and weather-control options.',
    bullets: ['Add optional extras from a compact multi-select rail.', 'Keep selections saved locally while you browse chapters.'],
    chapterId: 'extras',
    image: '/images/product-downlight-01.jpg',
    savedState: 'extras',
  },
  {
    id: 'compare',
    title: 'Compare',
    subtitle: 'Quick worth-it framing for your starting point.',
    bullets: ['Select your starting condition to frame likely outcomes.', 'Use this to prep for a focused consultation conversation.'],
    chapterId: 'compare',
    image: '/images/project-goodhome-01.jpg',
    savedState: 'compare',
  },
];

const SECTION_CONTAINER_CLASS = 'mx-auto w-full max-w-[1320px] px-4 py-[clamp(48px,6vh,88px)] md:px-8';
const TEXT_CONTAINER_CLASS = 'mx-auto w-full max-w-[920px]';
const SURFACE_CONTAINER_CLASS = 'mx-auto w-full max-w-[1200px]';

const PRIMARY_CTA_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
const PRIMARY_CTA_LARGE_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
const SECONDARY_CTA_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';
const SECONDARY_CTA_LARGE_CLASS =
  'inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-white transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

function labelForValue(options: ReadonlyArray<{ value: string; label: string }>, value?: string): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

function LocalProductNav({
  activeSection,
  elevated,
  onAnchorClick,
}: {
  activeSection: SectionId;
  elevated: boolean;
  onAnchorClick: (id: SectionId) => void;
}) {
  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-300 motion-reduce:transition-none ${
        elevated ? 'border-white/12 bg-black/70 backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-[1320px] px-4 md:px-8">
        <div className="flex items-center gap-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/80">Sanctuary Pergolas</p>
          <p className="hidden text-[13px] text-white/70 sm:block">Pergola Design</p>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/start"
              className="rounded-full border border-white/30 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-white transition hover:border-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Start the guide
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-white bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Book a Design Consultation
            </Link>
          </div>
        </div>
        <nav aria-label="Explore page sections" className="overflow-x-auto pb-3">
          <div className="flex min-w-max items-center gap-2 pr-4">
            {NAV_ANCHORS.map((anchor) => {
              const active = activeSection === anchor.id;
              return (
                <button
                  key={anchor.id}
                  type="button"
                  onClick={() => onAnchorClick(anchor.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    active
                      ? 'border-white/90 bg-white/16 text-white'
                      : 'border-white/25 bg-white/[0.03] text-white/75 hover:border-white/45 hover:text-white'
                  }`}
                >
                  {anchor.label}
                </button>
              );
            })}
          </div>
        </nav>
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
  cardWidthClassName = 'w-[320px]',
  imageSizes = '(max-width: 768px) 80vw, 320px',
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
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
              className={`group snap-start shrink-0 overflow-hidden rounded-3xl border text-left transition duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${cardWidthClassName} ${
                selected
                  ? 'border-white bg-white/[0.14] shadow-[0_16px_48px_-28px_rgba(255,255,255,0.7)]'
                  : 'border-white/20 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.08]'
              }`}
            >
              {option.image ? (
                <div className="relative aspect-[16/7] w-full overflow-hidden bg-white/5">
                  <Image src={option.image.src} alt={option.image.alt} fill sizes={imageSizes} className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 p-3">
                <p className="text-sm font-semibold text-white">{option.title}</p>
                {selected ? (
                  <span className="rounded-full border border-white/40 bg-white/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    Selected
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
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
  cardWidthClassName = 'w-[320px]',
  imageSizes = '(max-width: 768px) 80vw, 320px',
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
    : 'Select one or more extras to save your preferences.';

  return (
    <div className="space-y-3">
      <div
        id={groupId}
        tabIndex={-1}
        role="group"
        aria-label={groupLabel}
        onKeyDown={handleKeyDown}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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
              className={`group snap-start shrink-0 overflow-hidden rounded-3xl border text-left transition duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${cardWidthClassName} ${
                selected
                  ? 'border-white bg-white/[0.14] shadow-[0_16px_48px_-28px_rgba(255,255,255,0.7)]'
                  : 'border-white/20 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.08]'
              }`}
            >
              {option.image ? (
                <div className="relative aspect-[16/7] w-full overflow-hidden bg-white/5">
                  <Image src={option.image.src} alt={option.image.alt} fill sizes={imageSizes} className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 p-3">
                <p className="text-sm font-semibold text-white">{option.title}</p>
                {selected ? (
                  <span className="rounded-full border border-white/40 bg-white/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    Added
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {multiCaption ? <p className="text-sm text-white/74">{multiCaption}</p> : null}
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
                className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/45 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                className="rounded-full border border-white/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                    <p className="text-[11px] uppercase tracking-[0.13em] text-white/65">{row.label}</p>
                    <button
                      type="button"
                      onClick={() => onChangeRow(row)}
                      className="text-[11px] font-semibold uppercase tracking-[0.11em] text-white underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-1.5 text-sm text-white">{row.value}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/15 bg-white/[0.05] p-4 text-sm text-white/70">
                No selections yet. Choose any cards and they will appear here.
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-white/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Reset
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full border border-white bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Done
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/contact" className={PRIMARY_CTA_CLASS}>
              Book a Design Consultation
            </Link>
            <Link href="/start" className={SECONDARY_CTA_CLASS}>
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
  const [navElevated, setNavElevated] = useState(false);
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
      setNavElevated(window.scrollY > 12);
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

  const enclosureOptions = useMemo<CardOption[]>(
    () =>
      startFlowContent.extras.options
        .filter((option) => ENCLOSURE_EXTRA_IDS.has(option.value))
        .map((option) => ({
          id: option.value,
          title: option.label,
          description: option.description,
          image: EXTRA_MEDIA[option.value as ExtraId],
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

  const activeRoofStopIndex = Math.max(
    0,
    ROOF_STRIP_STOPS.findIndex((stop) => stop.id === activeRoofStop.id)
  );

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
    return (
      startFlowContent.extras.options.find((option) => option.value === selections.enclosure)?.label ?? null
    );
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
      enclosure: Boolean(selections.enclosure),
      extras: Boolean(selections.extrasNone || selectedExtraIds.length),
      consent: false,
      process: false,
    }),
    [selections.enclosure, selections.extrasNone, selections.path, selections.roofMaterial, selections.roofStyle, selectedExtraIds.length]
  );

  const activeDesignVisual = useMemo(() => {
    if (activePill === 'path') {
      const option = pathOptions.find((item) => item.id === selections.path) ?? pathOptions[0];
      return {
        image: option?.image ?? BRANCH_MEDIA.residential,
        title: option?.title ?? 'Path',
        caption: option?.description ?? 'Choose your path first to tune recommendations.',
      };
    }

    if (activePill === 'roofStyle') {
      const option = roofStyleOptions.find((item) => item.id === selections.roofStyle) ?? roofStyleOptions[0];
      return {
        image: option?.image ?? ROOF_STYLE_MEDIA.pitched,
        title: option?.title ?? 'Roof style',
        caption: option?.description ?? 'Select a roof geometry that suits your site and intent.',
      };
    }

    if (activePill === 'roofMaterial') {
      const option = roofMaterialOptions.find((item) => item.id === selections.roofMaterial) ?? roofMaterialOptions[0];
      return {
        image: option?.image ?? ROOF_MATERIAL_MEDIA.acrylic,
        title: option?.title ?? 'Roof material',
        caption: option?.description ?? 'Pair material choice with your preferred light behavior.',
      };
    }

    if (activePill === 'enclosure') {
      const option = enclosureOptions.find((item) => item.id === selections.enclosure) ?? enclosureOptions[0];
      return {
        image: option?.image ?? EXTRA_MEDIA.blinds,
        title: option?.title ?? 'Screens/enclosure',
        caption: option?.description ?? 'Set how open or sheltered you want the space to feel.',
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
    enclosureOptions,
    extrasOptions,
    pathOptions,
    roofMaterialOptions,
    roofStyleOptions,
    selections.enclosure,
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

  return (
    <div className="start-explore-page min-h-screen text-white">
      <LocalProductNav activeSection={activeSection} elevated={navElevated} onAnchorClick={scrollToSection} />

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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.2),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.78)_78%)]" />
          </div>
          <div className="relative mx-auto flex min-h-[84vh] max-h-[920px] w-full max-w-[1320px] items-end px-4 pb-12 pt-24 md:px-8 md:pb-16">
            <div className={`${TEXT_CONTAINER_CLASS} space-y-5`}>
              <p className="text-[13px] font-medium uppercase tracking-[0.17em] text-white/70">Sanctuary Pergolas</p>
              <h1 className="text-[clamp(44px,4.2vw,74px)] font-semibold leading-[1.03] tracking-tight">
                A pergola that feels built-in.
              </h1>
              <p className="max-w-[680px] text-[clamp(18px,2vw,22px)] leading-[1.45] text-white/82">
                Explore options, save what you like, then book a Design Consultation.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/contact" className={PRIMARY_CTA_LARGE_CLASS}>
                  Book a Design Consultation
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToSection('highlights')}
                  className={SECONDARY_CTA_LARGE_CLASS}
                >
                  Explore highlights
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="highlights" className={SECTION_CONTAINER_CLASS}>
          <div className={`${SURFACE_CONTAINER_CLASS} space-y-6`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Overview</p>
                <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Get the highlights.</h2>
              </div>
              <button
                type="button"
                onClick={() => setFilmOpen(true)}
                className="rounded-full border border-white/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Watch the film
              </button>
            </div>

            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {HIGHLIGHT_ITEMS.map((item) => {
                const active = item.id === activeHighlight.id;
                const saved = item.savedState ? highlightSavedState[item.savedState] : false;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveHighlightId(item.id)}
                    className={`group relative h-[250px] w-[320px] snap-start shrink-0 overflow-hidden rounded-3xl border text-left transition duration-200 motion-reduce:transition-none md:h-[260px] md:w-[420px] ${
                      active
                        ? 'border-white/75 shadow-[0_18px_42px_-26px_rgba(255,255,255,0.55)]'
                        : 'border-white/18 hover:border-white/40'
                    }`}
                  >
                    <Image
                      src={item.image}
                      alt={`${item.title} chapter preview`}
                      fill
                      sizes="(max-width: 900px) 320px, 420px"
                      className="object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-black/0" />
                    <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xl font-semibold">{item.title}</p>
                        {saved ? (
                          <span className="rounded-full border border-emerald-200/45 bg-emerald-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
                            Saved
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white/76">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl border border-white/12 bg-white/[0.04] p-4 md:min-h-[164px] md:p-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="max-w-[760px] space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[22px] font-semibold tracking-tight">{activeHighlight.title}</h3>
                    {activeHighlightSaved ? (
                      <span className="rounded-full border border-emerald-200/45 bg-emerald-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
                        Saved
                      </span>
                    ) : null}
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-white/78">
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
                    className={PRIMARY_CTA_CLASS}
                  >
                    Continue reading
                  </button>
                  <Link href="/start" className={SECONDARY_CTA_CLASS}>
                    Start the guide
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="design" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Design chapter</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Take a closer look.</h2>
            <p className="mt-4 text-[17px] leading-7 text-white/75">
              Move through key choices in order. Selections save immediately and the visual panel updates as you compare options.
            </p>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 md:p-6 lg:h-[min(72vh,720px)]`}>
            <div className="grid h-full gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
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
                          ? 'border-white/85 bg-white/14 text-white'
                          : 'border-white/25 bg-white/[0.03] text-white/80 hover:border-white/45 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{pill.label}</span>
                        <span className="flex items-center gap-2">
                          {pillSavedState[pill.id] ? (
                            <span className="rounded-full border border-emerald-200/45 bg-emerald-300/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-100">
                              Saved
                            </span>
                          ) : null}
                          <span className="text-base text-white/70" aria-hidden="true">
                            {active ? 'o' : '+'}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex h-full min-h-0 flex-col rounded-[24px] border border-white/12 bg-black/35 p-4 md:p-5">
                <div className="relative h-[clamp(200px,34vh,330px)] shrink-0 overflow-hidden rounded-[22px] border border-white/10">
                  <Image
                    src={activeDesignVisual.image.src}
                    alt={activeDesignVisual.image.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/25 to-black/0" />
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <p className="text-xl font-semibold">{activeDesignVisual.title}</p>
                    <p className="mt-1 max-w-[760px] text-sm text-white/78">{activeDesignVisual.caption}</p>
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {activePill === 'path' ? (
                    <OptionRailSelect
                      groupId="explore-path-group"
                      groupLabel="Choose your path"
                      options={pathOptions}
                      value={selections.path}
                      onChange={handlePathChange}
                      cardWidthClassName="w-[300px]"
                      imageSizes="(max-width: 768px) 78vw, 300px"
                    />
                  ) : null}

                  {activePill === 'roofStyle' ? (
                    <OptionRailSelect
                      groupId="design-roof-style-group"
                      groupLabel="Choose roof style"
                      options={roofStyleOptions}
                      value={selections.roofStyle}
                      onChange={handleRoofStyleChange}
                      cardWidthClassName="w-[300px]"
                      imageSizes="(max-width: 768px) 78vw, 300px"
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
                        cardWidthClassName="w-[300px]"
                        imageSizes="(max-width: 768px) 78vw, 300px"
                      />
                      {roofSecondaryOptions.length ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Material detail</p>
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
                                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                    selected
                                      ? 'border-white bg-white/18 text-white'
                                      : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
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

                  {activePill === 'enclosure' ? (
                    <OptionRailSelect
                      groupId="design-enclosure-group"
                      groupLabel="Choose screens or enclosure"
                      options={enclosureOptions}
                      value={selections.enclosure}
                      onChange={handleEnclosureChange}
                      cardWidthClassName="w-[300px]"
                      imageSizes="(max-width: 768px) 78vw, 300px"
                    />
                  ) : null}

                  {activePill === 'extras' ? (
                    <div className="space-y-4">
                      <OptionRailMulti
                        groupId="design-extras-group"
                        groupLabel="Choose extras"
                        options={extrasOptions}
                        values={selectedExtraIds}
                        onToggle={handleToggleExtra}
                        cardWidthClassName="w-[300px]"
                        imageSizes="(max-width: 768px) 78vw, 300px"
                      />
                      <button
                        type="button"
                        aria-pressed={Boolean(selections.extrasNone)}
                        onClick={() => handleSetNoExtras(!selections.extrasNone)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          selections.extrasNone
                            ? 'border-white bg-white/18 text-white'
                            : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
                        }`}
                      >
                        {startFlowContent.extras.noneLabel}
                      </button>
                    </div>
                  ) : null}

                  {activePill === 'consent' ? (
                    <div className="space-y-4 rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                      <p className="text-sm leading-6 text-white/80">{startFlowContent.consent.disclaimer}</p>
                      <ul className="space-y-2">
                        {startFlowContent.consent.links.map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-white underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {activePill === 'process' ? (
                    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
                      <ol className="space-y-2.5">
                        {startFlowContent.process.timeline.map((step, index) => (
                          <li key={step} className="flex items-center gap-3 text-sm text-white/82">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/25 text-[11px] text-white/85">
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
        </section>

        <section id="roof" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Roof chapter</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Dial in roof and light behavior.</h2>
            <p className="mt-4 text-[17px] leading-7 text-white/75">
              The interactive strip maps common roof material intents. Clicking a stop immediately updates your saved roof state.
            </p>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 md:p-6 lg:h-[min(75vh,760px)]`}>
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="min-w-[680px]">
                  <div className="relative h-[2px] rounded-full bg-white/20">
                    <div
                      className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white"
                      style={{
                        width: `${(activeRoofStopIndex / (ROOF_STRIP_STOPS.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-nowrap gap-2">
                    {ROOF_STRIP_STOPS.map((stop) => {
                      const selected = stop.id === activeRoofStop.id;
                      return (
                        <button
                          key={stop.id}
                          type="button"
                          onClick={() => handleRoofStripChange(stop)}
                          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            selected
                              ? 'border-white bg-white/18 text-white'
                              : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
                          }`}
                        >
                          {stop.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="relative h-[clamp(300px,42vh,460px)] shrink-0 overflow-hidden rounded-[24px] border border-white/12">
                <Image
                  src={activeRoofStop.image.src}
                  alt={activeRoofStop.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 80vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <p className="text-xl font-semibold">{activeRoofStop.label}</p>
                  <p className="mt-1 max-w-[760px] text-sm text-white/78">{activeRoofStop.caption}</p>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Roof style</p>
                  <OptionRailSelect
                    groupId="explore-roof-style-group"
                    groupLabel="Choose roof style"
                    options={roofStyleOptions}
                    value={selections.roofStyle}
                    onChange={handleRoofStyleChange}
                    cardWidthClassName="w-[280px]"
                    imageSizes="(max-width: 768px) 75vw, 280px"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Roof material</p>
                  <OptionRailSelect
                    groupId="explore-roof-material-group"
                    groupLabel="Choose roof material"
                    options={roofMaterialOptions}
                    value={selections.roofMaterial}
                    onChange={handleRoofMaterialChange}
                    cardWidthClassName="w-[280px]"
                    imageSizes="(max-width: 768px) 75vw, 280px"
                  />
                  {roofSecondaryOptions.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Material detail</p>
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
                              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                                selected
                                  ? 'border-white bg-white/18 text-white'
                                  : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
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

              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                <Link href="/contact" className={PRIMARY_CTA_CLASS}>
                  Book a Design Consultation
                </Link>
                <Link href="/start" className={SECONDARY_CTA_CLASS}>
                  Start the guide
                </Link>
                <p className="text-xs text-white/55">Your selections stay on this device.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="performance" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Performance</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Built for NZ conditions.</h2>
            <p className="mt-4 text-[17px] leading-7 text-white/75">
              Switch between the four performance lenses to understand how choices influence daily comfort and reliability.
            </p>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 md:p-6`}>
            <div role="tablist" aria-label="Performance tabs" onKeyDown={handlePerformanceTabKeyDown} className="flex flex-wrap gap-2">
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
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      selected
                        ? 'border-white bg-white/18 text-white'
                        : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              id={`perf-panel-${activePerformance.id}`}
              role="tabpanel"
              aria-labelledby={`perf-tab-${activePerformance.id}`}
              className="mt-5 grid gap-5 lg:h-[460px] lg:grid-cols-[1.2fr_1fr]"
            >
              <div className="relative h-[clamp(220px,32vh,360px)] overflow-hidden rounded-[22px] border border-white/12 lg:h-full">
                <Image
                  src={activePerformance.image.src}
                  alt={activePerformance.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/0" />
              </div>
              <div className="space-y-4 rounded-[22px] border border-white/12 bg-black/35 p-4 lg:h-full">
                <h3 className="text-xl font-semibold tracking-tight">{activePerformance.title}</h3>
                <ul className="space-y-2.5 text-sm leading-6 text-white/78">
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
        </section>

        <section id="shared" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Shared baseline</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">What every project includes.</h2>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6`}>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SHARED_FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="h-[236px] w-[320px] shrink-0 snap-start rounded-3xl border border-white/12 bg-white/[0.04] p-4"
                >
                  <h3 className="text-lg font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/72">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>

          {enclosureOptions.length ? (
            <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-3xl border border-white/12 bg-white/[0.04] p-4 md:p-5`}>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Optional</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">How enclosed do you want it to feel?</h3>
              <p className="mt-2 text-sm text-white/72">
                This is optional, but selecting one helps us understand your shelter and privacy preference.
              </p>
              <div className="mt-4">
                <OptionRailSelect
                  groupId="explore-enclosure-group"
                  groupLabel="Choose enclosure preference"
                  options={enclosureOptions}
                  value={selections.enclosure}
                  onChange={handleEnclosureChange}
                  cardWidthClassName="w-[300px]"
                  imageSizes="(max-width: 768px) 78vw, 300px"
                />
              </div>
            </div>
          ) : null}
        </section>

        <section id="extras" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Extras</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Personalize your everyday use.</h2>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 md:p-6`}>
            <OptionRailMulti
              groupId="explore-extras-group"
              groupLabel="Choose extras"
              options={extrasOptions}
              values={selectedExtraIds}
              onToggle={handleToggleExtra}
              cardWidthClassName="w-[320px]"
              imageSizes="(max-width: 768px) 80vw, 320px"
            />
            <button
              type="button"
              aria-pressed={Boolean(selections.extrasNone)}
              onClick={() => handleSetNoExtras(!selections.extrasNone)}
              className={`mt-4 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                selections.extrasNone
                  ? 'border-white bg-white/18 text-white'
                  : 'border-white/25 bg-white/[0.04] text-white/75 hover:border-white/45 hover:text-white'
              }`}
            >
              {startFlowContent.extras.noneLabel}
            </button>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <Link href="/contact" className={PRIMARY_CTA_CLASS}>
                Book a Design Consultation
              </Link>
              <Link href="/start" className={SECONDARY_CTA_CLASS}>
                Start the guide
              </Link>
            </div>
          </div>
        </section>

        <section id="compare" className={SECTION_CONTAINER_CLASS}>
          <div className={TEXT_CONTAINER_CLASS}>
            <p className="text-[13px] uppercase tracking-[0.14em] text-white/62">Worth it?</p>
            <h2 className="mt-2 text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">What are you starting with?</h2>
          </div>

          <div className={`${SURFACE_CONTAINER_CLASS} mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 md:p-6 lg:h-[420px]`}>
            <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
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
                            ? 'border-white bg-white/14 text-white'
                            : 'border-white/25 bg-white/[0.03] text-white/78 hover:border-white/45 hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <Link href="/contact" className={PRIMARY_CTA_CLASS}>
                    Book a Design Consultation
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-white/12 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">What changes</p>
                {activeCompareOutcomes ? (
                  <ul className="mt-2.5 space-y-2.5 text-sm text-white/78">
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
                  <p className="mt-2.5 text-sm text-white/68">Choose a starting point to preview the likely benefits.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="mx-auto w-full max-w-[1320px] px-4 py-[clamp(48px,6vh,88px)] md:px-8">
          <div className={`${SURFACE_CONTAINER_CLASS} rounded-[32px] border border-white/12 bg-white/[0.05] p-6 md:p-10 lg:max-h-[420px] lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
            <div className={TEXT_CONTAINER_CLASS}>
              <h2 className="text-[clamp(34px,3vw,56px)] font-semibold tracking-tight">Ready to talk through your space?</h2>
              <p className="mt-4 text-[17px] leading-7 text-white/75">
                Book a Design Consultation - your saved preferences carry through.
              </p>
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
              <div className="mt-6 rounded-2xl border border-white/12 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-white/65">Saved selections</p>
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
        </section>
      </main>

      <button
        type="button"
        onClick={() => setReviewOpen(true)}
        className="fixed bottom-6 right-6 z-[60] hidden rounded-full border border-white/35 bg-black/65 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-md transition hover:border-white/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex"
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
          <span className="text-xs uppercase tracking-[0.1em] text-white/75">
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
