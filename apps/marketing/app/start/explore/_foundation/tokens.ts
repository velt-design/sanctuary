// Apple-like light theme tokens for this page only.
// Keep these stable. Avoid per-section one-offs.

export const T = {
  // Page
  PAGE: 'min-h-dvh bg-white text-[#1d1d1f] [color-scheme:light]',

  // Layout
  SHELL: 'mx-auto w-full max-w-[1360px] px-6 sm:px-8 lg:px-12',
  SECTION_Y: 'py-14 sm:py-16 lg:py-20',
  HEADER_GAP: 'mt-6 sm:mt-7 lg:mt-8',

  // Typography
  KICKER: 'text-[12px] font-semibold tracking-[0.02em] text-[#6e6e73]',
  H1: 'text-balance font-semibold tracking-[-0.02em] leading-[1.05] text-[clamp(36px,4vw,56px)]',
  H2: 'text-balance font-semibold tracking-[-0.015em] leading-[1.1] text-[clamp(24px,2.4vw,36px)]',
  LEDE: 'mt-3 text-[17px] leading-[1.55] text-[#6e6e73] max-w-[60ch]',

  // Section tones
  TINT_BG: 'bg-[#f5f5f7]',

  // Surfaces / stages
  STAGE_SURFACE: 'relative w-full overflow-hidden rounded-[28px] bg-white ring-1 ring-black/5',
  STAGE_H: 'h-[clamp(520px,70vh,760px)]',
  STAGE_WIDE_H: 'h-[clamp(360px,45vh,560px)]',

  // Stage Explorer (Apple Take-a-closer-look scaffolding)
  // 3 lanes at desktop: pills / bubble / media
  STAGE_EXPLORER_INNER: 'h-full p-6 sm:p-8 lg:p-10',
  STAGE_EXPLORER_GRID: 'grid h-full grid-cols-1 gap-8 lg:grid-cols-[240px_320px_minmax(0,1fr)] lg:gap-10',

  // Pills
  PILL_LIST: 'flex flex-col gap-3',
  PILL_BTN:
    'h-11 w-full rounded-full bg-[#f5f5f7] ring-1 ring-black/5 px-4 text-[14px] font-semibold text-[#1d1d1f] flex items-center justify-between',
  PILL_BTN_ACTIVE: 'bg-[#ededf0] ring-black/10',

  PILL_ICON:
    'size-7 shrink-0 rounded-full bg-white ring-1 ring-black/10 flex items-center justify-center text-[#1d1d1f]',
  PILL_LABEL: 'truncate',

  // Media placeholder
  MEDIA_LANE: 'min-w-0 flex items-center justify-center',
  MEDIA_PLACEHOLDER:
    'h-full w-full rounded-[22px] bg-[#f5f5f7] ring-1 ring-black/5 flex items-center justify-center text-[#6e6e73] text-[14px]',

  // Roof strip
  ROOF_WRAP: 'sticky top-0 z-50 w-full bg-white/80 backdrop-blur border-b border-black/[0.08]',
  ROOF_INNER: 'flex h-12 items-center gap-4',
  ROOF_LEFT: 'flex items-center gap-3 min-w-0',
  ROOF_RIGHT: 'ml-auto flex items-center gap-3',

  CTA_PRIMARY:
    'inline-flex h-8 items-center rounded-full bg-[#0071e3] px-4 text-[12px] font-semibold text-white whitespace-nowrap',
  CTA_SECONDARY:
    'inline-flex h-8 items-center rounded-full bg-transparent ring-1 ring-black/10 px-4 text-[12px] font-semibold text-[#1d1d1f] whitespace-nowrap',

  // Materials Explorer (Apple Take-a-closer-look parity)
  ME_GRID: 'grid h-full grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] lg:gap-10',
  ME_LANE_STACK: 'flex h-full min-h-0 flex-col',
  ME_MEDIA_LANE: 'flex h-full min-h-0 min-w-0 items-center justify-center',

  // Pills (Apple-like)
  ME_PILL_LIST: 'flex flex-col gap-3',
  ME_PILL_BTN:
    'h-11 w-full rounded-full bg-[#f5f5f7] px-4 text-[14px] font-semibold text-[#1d1d1f] ring-1 ring-black/5 flex items-center justify-between',
  ME_PILL_BTN_ACTIVE: 'bg-[#ededf0] ring-black/10',
  ME_PILL_LEFT: 'flex min-w-0 items-center gap-3',
  ME_PILL_DOT_WRAP: 'flex size-3 items-center justify-center',
  ME_PILL_DOT: 'size-2 rounded-full bg-transparent',
  ME_PILL_DOT_ACTIVE: 'bg-[#0071e3]',
  ME_PILL_LABEL: 'truncate',
  ME_PILL_PLUS_HIT:
    'flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#1d1d1f] ring-1 ring-black/10',

  // Bubble lane (desktop)
  ME_BUBBLE_LANE: 'relative hidden h-full lg:block',
  ME_BUBBLE_WRAP: 'absolute left-0 w-full will-change-transform',
  ME_BUBBLE: 'rounded-[24px] bg-[#ededf0] px-6 py-5 text-[#1d1d1f]',
  ME_BUBBLE_TITLE: 'text-[14px] font-semibold leading-[1.35]',
  ME_BUBBLE_BODY: 'mt-2 text-[14px] leading-[1.5] text-[#6e6e73]',

  // Bubble (mobile insertion under active pill)
  ME_BUBBLE_MOBILE_WRAP: 'mt-3',

  // Controls (focus mode)
  ME_CTRL_STACK: 'absolute left-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex',
  ME_CTRL_BTN:
    'size-10 rounded-full bg-white text-[#1d1d1f] ring-1 ring-black/10 flex items-center justify-center',
  ME_CLOSE_BTN:
    'absolute right-6 top-6 size-10 rounded-full bg-white text-[#1d1d1f] ring-1 ring-black/10 flex items-center justify-center',

  // Media container
  ME_MEDIA_INNER: 'relative h-full w-full',
  ME_MEDIA_FRAME:
    'relative h-full w-full overflow-hidden rounded-[22px] bg-[#f5f5f7] ring-1 ring-black/5',

  // Focus media transform (subtle, transform-only)
  ME_MEDIA_FOCUS: 'lg:scale-[1.03] lg:translate-x-2',

  // Swatches (Aluminium focus)
  ME_SWATCH_ROW: 'mt-5 flex items-center gap-3 overflow-x-auto pb-1',
  ME_SWATCH_BTN: 'size-8 rounded-full ring-1 ring-black/10',
  ME_SWATCH_SELECTED: 'ring-2 ring-black/20',

  // Motion tokens (defined now; implemented later)
  DUR_SWAP: 280,
  DUR_EXPAND: 360,
} as const;
