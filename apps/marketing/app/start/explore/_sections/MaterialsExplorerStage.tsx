'use client';

import * as React from 'react';
import { cn } from '../_foundation/cn';
import { T } from '../_foundation/tokens';
import { StageSurface } from '../_foundation/StageSurface';
import { DebugFrame } from '../_foundation/DebugFrame';
import { CrossfadeImage } from '../_foundation/CrossfadeImage';

type MaterialId = 'acrylic' | 'timber' | 'combo' | 'aluminium';
type Mode = 'browse' | 'focus';
type AluminiumColorId = 'silver' | 'white' | 'black' | 'bronze';

type MediaSpec = {
  src: string;
  alt: string;
  fit: 'contain' | 'cover';
  position?: string;
};

type MaterialConfig = {
  id: MaterialId;
  label: string;
  bubbleTitle: string;
  bubbleBody: string;
  accentDot?: string;
  media: { browse: MediaSpec; focus: MediaSpec };
  aluminiumColors?: Array<{
    id: AluminiumColorId;
    label: string;
    hex: string;
    media: { browse: MediaSpec; focus: MediaSpec };
  }>;
};

const MATERIALS: MaterialConfig[] = [
  {
    id: 'acrylic',
    label: 'Acrylic',
    bubbleTitle: 'Acrylic.',
    bubbleBody: 'Bright, clean light with a crisp finish. A minimal look that stays quiet in the architecture.',
    media: {
      browse: {
        src: '/start-explore/materials/acrylic/browse.jpg',
        alt: 'Acrylic material option',
        fit: 'contain',
      },
      focus: {
        src: '/start-explore/materials/acrylic/focus.jpg',
        alt: 'Acrylic material close-up',
        fit: 'cover',
        position: 'center',
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
        src: '/start-explore/materials/timber/browse.jpg',
        alt: 'Timber material option',
        fit: 'contain',
      },
      focus: {
        src: '/start-explore/materials/timber/focus.jpg',
        alt: 'Timber material close-up',
        fit: 'cover',
        position: 'center',
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
        src: '/start-explore/materials/combination/browse.jpg',
        alt: 'Combination material option',
        fit: 'contain',
      },
      focus: {
        src: '/start-explore/materials/combination/focus.jpg',
        alt: 'Combination material close-up',
        fit: 'cover',
        position: 'center',
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
        src: '/start-explore/materials/aluminium/browse-silver.jpg',
        alt: 'Aluminium material option',
        fit: 'contain',
      },
      focus: {
        src: '/start-explore/materials/aluminium/focus-silver.jpg',
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
            src: '/start-explore/materials/aluminium/browse-silver.jpg',
            alt: 'Aluminium in silver',
            fit: 'contain',
          },
          focus: {
            src: '/start-explore/materials/aluminium/focus-silver.jpg',
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
            src: '/start-explore/materials/aluminium/browse-white.jpg',
            alt: 'Aluminium in white',
            fit: 'contain',
          },
          focus: {
            src: '/start-explore/materials/aluminium/focus-white.jpg',
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
            src: '/start-explore/materials/aluminium/browse-black.jpg',
            alt: 'Aluminium in black',
            fit: 'contain',
          },
          focus: {
            src: '/start-explore/materials/aluminium/focus-black.jpg',
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
            src: '/start-explore/materials/aluminium/browse-bronze.jpg',
            alt: 'Aluminium in bronze',
            fit: 'contain',
          },
          focus: {
            src: '/start-explore/materials/aluminium/focus-bronze.jpg',
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

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MaterialsExplorerStage({ debug }: { debug?: boolean }) {
  const [active, setActive] = React.useState<MaterialId>('acrylic');
  const [mode, setMode] = React.useState<Mode>('browse');
  const [aluColor, setAluColor] = React.useState<AluminiumColorId>('silver');
  const [bubbleTop, setBubbleTop] = React.useState(0);

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const bubbleLaneRef = React.useRef<HTMLDivElement | null>(null);
  const bubbleRef = React.useRef<HTMLDivElement | null>(null);

  const pillRefMap = React.useRef<Record<MaterialId, HTMLButtonElement | null>>({
    acrylic: null,
    timber: null,
    combo: null,
    aluminium: null,
  });

  const plusRefMap = React.useRef<Record<MaterialId, HTMLSpanElement | null>>({
    acrylic: null,
    timber: null,
    combo: null,
    aluminium: null,
  });

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

  React.useLayoutEffect(() => {
    if (!isFocus) return;

    const listEl = listRef.current;
    const pillEl = pillRefMap.current[active];
    const laneEl = bubbleLaneRef.current;
    const bEl = bubbleRef.current;

    if (!listEl || !pillEl || !laneEl || !bEl) return;

    const listRect = listEl.getBoundingClientRect();
    const pillRect = pillEl.getBoundingClientRect();
    const laneRect = laneEl.getBoundingClientRect();
    const bubbleRect = bEl.getBoundingClientRect();

    const anchorY = pillRect.top - listRect.top + pillRect.height / 2;
    let top = anchorY - bubbleRect.height / 2;
    const maxTop = Math.max(0, laneRect.height - bubbleRect.height);
    top = Math.max(0, Math.min(top, maxTop));

    setBubbleTop(top);
  }, [active, isFocus]);

  function enterFocus(nextActive?: MaterialId) {
    if (nextActive) setActive(nextActive);
    setMode('focus');
  }

  function exitFocus() {
    setMode('browse');
  }

  function cycle(delta: number) {
    const idx = MATERIALS.findIndex((m) => m.id === active);
    const next = (idx + delta + MATERIALS.length) % MATERIALS.length;
    setActive(MATERIALS[next].id);
    setMode('focus');
  }

  function onPillClick(id: MaterialId) {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      const target = event.target as Node;
      const plusEl = plusRefMap.current[id];
      const hitPlus = plusEl ? plusEl.contains(target) : false;

      if (isFocus) {
        setActive(id);
        return;
      }

      if (hitPlus) {
        enterFocus(id);
        return;
      }

      if (id === active) {
        enterFocus();
        return;
      }

      setActive(id);
    };
  }

  const showSwatches = isFocus && active === 'aluminium' && Boolean(aluminiumCfg?.aluminiumColors);

  return (
    <DebugFrame enabled={debug} label="Materials Explorer: Stage">
      <StageSurface>
        <div className={T.STAGE_EXPLORER_INNER}>
          {isFocus ? (
            <>
              <div className={T.ME_CTRL_STACK}>
                <button type="button" className={T.ME_CTRL_BTN} aria-label="Previous material" onClick={() => cycle(-1)}>
                  <IconChevronUp />
                </button>
                <button type="button" className={T.ME_CTRL_BTN} aria-label="Next material" onClick={() => cycle(1)}>
                  <IconChevronDown />
                </button>
              </div>

              <button type="button" className={T.ME_CLOSE_BTN} aria-label="Close" onClick={exitFocus}>
                <IconClose />
              </button>
            </>
          ) : null}

          <div className={cn(T.ME_GRID)}>
            <DebugFrame enabled={debug} label="Lane: Pills">
              <div ref={listRef} className={T.ME_LANE_STACK}>
                <div className={T.ME_PILL_LIST}>
                  {MATERIALS.map((m) => {
                    const activeRow = m.id === active;
                    const dotColor =
                      m.id === 'aluminium' && activeRow && activeAlu ? activeAlu.hex : (activeCfg.accentDot ?? undefined);

                    return (
                      <React.Fragment key={m.id}>
                        <button
                          ref={(el) => {
                            pillRefMap.current[m.id] = el;
                          }}
                          type="button"
                          onClick={onPillClick(m.id)}
                          className={cn(T.ME_PILL_BTN, activeRow && T.ME_PILL_BTN_ACTIVE)}
                          aria-current={activeRow ? 'true' : undefined}
                          aria-expanded={activeRow && isFocus ? true : undefined}
                        >
                          <span className={T.ME_PILL_LEFT}>
                            <span className={T.ME_PILL_DOT_WRAP} aria-hidden="true">
                              <span
                                className={cn(T.ME_PILL_DOT, activeRow ? T.ME_PILL_DOT_ACTIVE : '')}
                                style={activeRow && dotColor ? { backgroundColor: dotColor } : undefined}
                              />
                            </span>
                            <span className={T.ME_PILL_LABEL}>{m.label}</span>
                          </span>

                          <span
                            ref={(el) => {
                              plusRefMap.current[m.id] = el;
                            }}
                            className={T.ME_PILL_PLUS_HIT}
                            aria-hidden="true"
                            style={{ opacity: activeRow ? 0 : 1 }}
                          >
                            <IconPlus />
                          </span>
                        </button>

                        {activeRow && isFocus ? (
                          <div className={T.ME_BUBBLE_MOBILE_WRAP}>
                            <div className={T.ME_BUBBLE}>
                              <div className={T.ME_BUBBLE_TITLE}>{activeCfg.bubbleTitle}</div>
                              <div className={T.ME_BUBBLE_BODY}>{activeCfg.bubbleBody}</div>

                              {showSwatches && aluminiumCfg?.aluminiumColors ? (
                                <div className={T.ME_SWATCH_ROW} aria-label="Aluminium colours">
                                  {aluminiumCfg.aluminiumColors.map((c) => {
                                    const selected = c.id === aluColor;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className={cn(T.ME_SWATCH_BTN, selected && T.ME_SWATCH_SELECTED)}
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
                          </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </DebugFrame>

            <DebugFrame enabled={debug} label="Lane: Bubble">
              <div ref={bubbleLaneRef} className={T.ME_BUBBLE_LANE}>
                {isFocus ? (
                  <div className={T.ME_BUBBLE_WRAP} style={{ transform: `translateY(${bubbleTop}px)` }}>
                    <div ref={bubbleRef} className={T.ME_BUBBLE}>
                      <div className={T.ME_BUBBLE_TITLE}>{activeCfg.bubbleTitle}</div>
                      <div className={T.ME_BUBBLE_BODY}>{activeCfg.bubbleBody}</div>

                      {showSwatches && aluminiumCfg?.aluminiumColors ? (
                        <div className={T.ME_SWATCH_ROW} aria-label="Aluminium colours">
                          {aluminiumCfg.aluminiumColors.map((c) => {
                            const selected = c.id === aluColor;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={cn(T.ME_SWATCH_BTN, selected && T.ME_SWATCH_SELECTED)}
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
                  </div>
                ) : (
                  <div />
                )}
              </div>
            </DebugFrame>

            <DebugFrame enabled={debug} label="Lane: Media">
              <div className={T.ME_MEDIA_LANE}>
                <div className={T.ME_MEDIA_FRAME}>
                  <div
                    className={cn(T.ME_MEDIA_INNER, isFocus && T.ME_MEDIA_FOCUS)}
                    style={{
                      transition: `transform ${T.DUR_EXPAND}ms ease`,
                    }}
                  >
                    <CrossfadeImage
                      src={mediaSpec.src}
                      alt={mediaSpec.alt}
                      fit={mediaSpec.fit}
                      position={mediaSpec.position}
                      priority
                    />
                  </div>
                </div>
              </div>
            </DebugFrame>
          </div>
        </div>
      </StageSurface>
    </DebugFrame>
  );
}
