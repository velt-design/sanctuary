'use client';

import Link from 'next/link';
import {
  type CSSProperties,
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SIMPLE_COVER_DEFAULT_PROJECTION_MM,
  SIMPLE_COVER_DEFAULT_WIDTH_MM,
  SIMPLE_COVER_DEFAULT_CONNECTION,
  SIMPLE_COVER_CONNECTION_OPTIONS,
  SIMPLE_COVER_ELEVATED_MAX_AREA_M2,
  SIMPLE_COVER_FRONT_BEAM_WIDTH_MM,
  SIMPLE_COVER_GROUND_MAX_AREA_M2,
  SIMPLE_COVER_INCREMENT_MM,
  SIMPLE_COVER_LEDGER_WIDTH_MM,
  SIMPLE_COVER_MAX_POST_SPACING_MM,
  SIMPLE_COVER_POST_SIZE_MM,
  SIMPLE_COVER_PROJECTION_MAX_MM,
  SIMPLE_COVER_PROJECTION_MIN_MM,
  SIMPLE_COVER_RAFTER_WIDTH_MM,
  SIMPLE_COVER_WIDTH_MAX_MM,
  SIMPLE_COVER_WIDTH_MIN_MM,
  buildSimpleCoverPlan,
  getSimpleCoverCustomResult,
  simpleCoverAreaM2,
  simpleCoverPostCount,
  type SimpleCoverInput,
  type SimpleCoverConnection,
  type SimpleCoverLevel,
  type SimpleCoverPublicResult,
} from '@/lib/simpleCoverCalculator';
import styles from './SimpleCoverCalculator.module.css';

const PRICE_DEBOUNCE_MS = 180;

type DimensionKey = 'widthMm' | 'projectionMm';
type PlanFootprintStyle = CSSProperties & {
  '--member-50'?: string;
  '--member-100'?: string;
  '--plan-ratio'?: number;
};
type RangeControlStyle = CSSProperties & {
  '--range-progress': string;
};

function formatMetres(mm: number): string {
  return `${(mm / 1_000).toFixed(1)} m`;
}

function formatArea(areaM2: number): string {
  return `${areaM2.toFixed(1)} m²`;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(value);
}

function currentResultMatches(result: SimpleCoverPublicResult | null, input: SimpleCoverInput): boolean {
  return Boolean(
    result
    && 'input' in result
    && result.input.widthMm === input.widthMm
    && result.input.projectionMm === input.projectionMm
    && result.input.level === input.level
    && result.input.connection === input.connection,
  );
}

function DimensionControl({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draftMetres, setDraftMetres] = useState((value / 1_000).toFixed(1));

  useEffect(() => {
    setDraftMetres((value / 1_000).toFixed(1));
  }, [value]);

  function commitDraft() {
    const parsedMetres = Number.parseFloat(draftMetres);
    if (!Number.isFinite(parsedMetres)) {
      setDraftMetres((value / 1_000).toFixed(1));
      return;
    }
    const snappedMm = Math.round(parsedMetres * 10) * SIMPLE_COVER_INCREMENT_MM;
    const nextValue = Math.min(max, Math.max(min, snappedMm));
    setDraftMetres((nextValue / 1_000).toFixed(1));
    onChange(nextValue);
  }

  const metreMarks = Array.from(
    { length: Math.floor((max - min) / 1_000) + 1 },
    (_, index) => min + index * 1_000,
  );
  const rangeStyle: RangeControlStyle = {
    '--range-progress': `${((value - min) / (max - min)) * 100}%`,
  };

  return (
    <div className={styles.dimensionControl}>
      <div className={styles.dimensionHeading}>
        <label htmlFor={id}>{label}</label>
        <label className={styles.dimensionValue} data-dimension-value>
          <span className={styles.srOnly}>{label} in metres</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={draftMetres}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraftMetres(event.currentTarget.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDraft();
                event.currentTarget.blur();
              }
              if (event.key === 'Escape') {
                setDraftMetres((value / 1_000).toFixed(1));
                event.currentTarget.blur();
              }
            }}
          />
          <span aria-hidden="true">m</span>
        </label>
      </div>
      <div className={styles.rangeControl} style={rangeStyle}>
        <input
          id={id}
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={SIMPLE_COVER_INCREMENT_MM}
          value={value}
          aria-valuetext={formatMetres(value)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value))}
        />
        <div className={styles.rangeRail} aria-hidden="true">
          {metreMarks.map((mark, index) => (
            <span
              className={styles.rangeStop}
              data-terminal={index === 0 || index === metreMarks.length - 1 ? 'true' : undefined}
              style={{ left: `${((mark - min) / (max - min)) * 100}%` }}
              key={mark}
            >
              {mark / 1_000}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConceptPlan({
  input,
  result,
}: {
  input: SimpleCoverInput;
  result: SimpleCoverPublicResult | null;
}) {
  const areaM2 = simpleCoverAreaM2(input);
  const postCount = simpleCoverPostCount(input.widthMm);
  const matching = currentResultMatches(result, input) && result && 'plan' in result ? result : null;
  const plan = matching?.plan?.rafterPositions.length
    ? matching.plan
    : buildSimpleCoverPlan(input.widthMm, postCount);
  const rafterSpacingMm = plan.rafterPositions.length > 1
    ? Math.round((plan.rafterPositions[1] - plan.rafterPositions[0]) * input.widthMm)
    : 0;
  const isShallowPlan = input.widthMm / input.projectionMm >= 4;
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const scale = viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(
        viewportSize.width * .8 / input.widthMm,
        viewportSize.height * .66 / input.projectionMm,
      )
    : 0;
  const footprintStyle: PlanFootprintStyle = scale > 0
    ? {
        width: input.widthMm * scale,
        height: input.projectionMm * scale,
        '--member-50': `${Math.max(3, SIMPLE_COVER_RAFTER_WIDTH_MM * scale)}px`,
        '--member-100': `${Math.max(5, SIMPLE_COVER_POST_SIZE_MM * scale)}px`,
      }
    : {
        '--plan-ratio': input.widthMm / input.projectionMm,
      };
  const connectionLabel = SIMPLE_COVER_CONNECTION_OPTIONS.find(({ value }) => value === input.connection)?.label
    ?? 'Fascia';
  const connectionDescription = input.connection === 'soffit'
    ? 'soffit-bracket'
    : connectionLabel.toLowerCase();
  const houseEdgeLabel = input.connection === 'soffit'
    ? 'House / soffit edge'
    : `House / ${input.connection} edge`;
  const label = `Concept plan for a ${formatMetres(input.widthMm)} wide by ${formatMetres(input.projectionMm)} projection pitched acrylic cover, ${formatArea(areaM2)}, with a ${connectionDescription} connection and ${postCount} posts.`;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const { width, height } = viewport.getBoundingClientRect();
      setViewportSize((current) => (
        current.width === width && current.height === height ? current : { width, height }
      ));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className={styles.planFigure}>
      <div className={styles.planTopline} data-plan-header>
        <div>
          <span>Architectural plan</span>
          <small>Plan / scale to fit</small>
        </div>
        <span>{input.level === 'ground' ? 'Ground level' : 'Elevated'}</span>
      </div>
      <div ref={viewportRef} className={styles.planViewport} role="img" aria-label={label}>
        <div className={styles.planGrid} aria-hidden="true" />
        <div
          className={`${styles.footprint} ${isShallowPlan ? styles.shallowPlan : ''}`.trim()}
          style={footprintStyle}
          aria-hidden="true"
          data-plan-footprint
        >
          <div className={styles.houseBand}><span>{houseEdgeLabel}</span></div>
          <div className={styles.roofField}>
            {plan.rafterPositions.map((position, index) => (
              <span
                className={styles.rafter}
                style={{ left: `${position * 100}%` }}
                key={`rafter-${index}`}
                data-plan-rafter
              />
            ))}
            <span className={styles.fallArrow}>Roof fall</span>
          </div>
          <div className={styles.ledger} data-plan-ledger />
          <div className={styles.frontBeam} data-plan-front-beam />
          {plan.postPositions.map((position) => (
            <span
              className={styles.post}
              style={{ left: `${position * 100}%` }}
              key={`post-${position}`}
              data-plan-post
            />
          ))}
          <div className={styles.widthDimension}>
            <i className={styles.dimensionStart} />
            <i className={styles.dimensionEnd} />
            <span>{formatMetres(input.widthMm)} width</span>
          </div>
          <div className={styles.projectionDimension}>
            <i className={styles.dimensionStart} />
            <i className={styles.dimensionEnd} />
            <span>{formatMetres(input.projectionMm)} projection</span>
          </div>
        </div>
      </div>
      <figcaption>
        <span>Concept plan, not a construction drawing.</span>
        <span>{SIMPLE_COVER_RAFTER_WIDTH_MM} mm rafters / {SIMPLE_COVER_LEDGER_WIDTH_MM} mm ledger · {SIMPLE_COVER_FRONT_BEAM_WIDTH_MM} mm beam / {SIMPLE_COVER_POST_SIZE_MM} mm posts</span>
        <span>{postCount} posts · max {SIMPLE_COVER_MAX_POST_SPACING_MM / 1_000} m · rafters {rafterSpacingMm} mm c/c</span>
      </figcaption>
    </figure>
  );
}

function PricingResult({
  input,
  result,
  pending,
}: {
  input: SimpleCoverInput;
  result: SimpleCoverPublicResult | null;
  pending: boolean;
}) {
  const isCurrent = currentResultMatches(result, input);
  const visibleResult = result && (isCurrent || result.status === 'unavailable' || result.status === 'invalid')
    ? result
    : null;

  if (visibleResult?.status === 'custom') {
    return (
      <div className={`${styles.resultCard} ${styles.customCard}`} data-result-state="custom">
        <span className={styles.resultEyebrow}>Custom design recommended</span>
        <h3>Let’s resolve this one around your site.</h3>
        <p>{visibleResult.reason}</p>
        <p className={styles.customNote}>Your dimensions have been kept. We’ll use them as the starting point for a tailored design.</p>
        <Link className={styles.resultLink} href={visibleResult.continuation.href}>
          {visibleResult.continuation.label}
        </Link>
      </div>
    );
  }

  if (visibleResult?.status === 'priced') {
    return (
      <div className={styles.resultCard} data-result-state="priced">
        <span className={styles.resultEyebrow}>Initial installed estimate</span>
        <p className={styles.price}>From {formatPrice(visibleResult.price.fromIncGst)}</p>
        <p className={styles.inclusion}>GST and standard installation included.</p>
        <div className={styles.resultMeta}>
          <span>Live pricing set v{visibleResult.configuration.versionNumber}</span>
          <span>{formatArea(visibleResult.areaM2)}</span>
        </div>
        <small>Subject to site measure, structural review and confirmed scope.</small>
      </div>
    );
  }

  if (visibleResult?.status === 'unavailable' || visibleResult?.status === 'invalid') {
    return (
      <div className={`${styles.resultCard} ${styles.unavailableCard}`} data-result-state={visibleResult.status}>
        <span className={styles.resultEyebrow}>Estimate unavailable</span>
        <h3>Your design is still here.</h3>
        <p>{visibleResult.message}</p>
      </div>
    );
  }

  return (
    <div className={`${styles.resultCard} ${styles.loadingCard}`} data-result-state="loading" aria-busy={pending}>
      <span className={styles.resultEyebrow}>Live installed estimate</span>
      <div className={styles.priceSkeleton} aria-hidden="true" />
      <p>Calculating from the current Sanctuary pricing set…</p>
    </div>
  );
}

export default function SimpleCoverCalculator({ className = '' }: { className?: string }) {
  const [input, setInput] = useState<SimpleCoverInput>({
    widthMm: SIMPLE_COVER_DEFAULT_WIDTH_MM,
    projectionMm: SIMPLE_COVER_DEFAULT_PROJECTION_MM,
    level: 'ground',
    connection: SIMPLE_COVER_DEFAULT_CONNECTION,
  });
  const [result, setResult] = useState<SimpleCoverPublicResult | null>(null);
  const [pending, setPending] = useState(true);
  const requestSequence = useRef(0);
  const customResult = useMemo(() => getSimpleCoverCustomResult(input), [input]);
  const areaM2 = simpleCoverAreaM2(input);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (customResult) {
      setResult(customResult);
      setPending(false);
      return;
    }

    const controller = new AbortController();
    setPending(true);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/simple-cover-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
          cache: 'no-store',
          signal: controller.signal,
        });
        const next = await response.json() as SimpleCoverPublicResult;
        if (sequence !== requestSequence.current || controller.signal.aborted) return;
        setResult(next);
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setResult({
          ok: false,
          status: 'unavailable',
          message: 'Live pricing is temporarily unavailable. Your selections are still here—please try again shortly.',
        });
      } finally {
        if (sequence === requestSequence.current && !controller.signal.aborted) setPending(false);
      }
    }, PRICE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [customResult, input]);

  function setDimension(key: DimensionKey, value: number) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function setLevel(level: SimpleCoverLevel) {
    setInput((current) => ({ ...current, level }));
  }

  function setConnection(connection: SimpleCoverConnection) {
    setInput((current) => ({ ...current, connection }));
  }

  return (
    <section className={`${styles.calculator} ${className}`.trim()} aria-labelledby="simple-cover-calculator-title" data-simple-cover-calculator>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Simple cover calculator</p>
          <h2 id="simple-cover-calculator-title">Shape the cover. See the plan and price together.</h2>
        </div>
        <p>Adjust the footprint and deck level. The estimate follows the same published costing configuration used by our staff calculator.</p>
      </header>

      <div className={styles.workspace}>
        <form className={styles.controls} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.controlsHeading}>
            <span>01 / Dimensions</span>
            <strong>{formatArea(areaM2)}</strong>
          </div>
          <DimensionControl
            id="simple-cover-width"
            label="Width along the house"
            value={input.widthMm}
            min={SIMPLE_COVER_WIDTH_MIN_MM}
            max={SIMPLE_COVER_WIDTH_MAX_MM}
            onChange={(value) => setDimension('widthMm', value)}
          />
          <DimensionControl
            id="simple-cover-projection"
            label="Projection from the house"
            value={input.projectionMm}
            min={SIMPLE_COVER_PROJECTION_MIN_MM}
            max={SIMPLE_COVER_PROJECTION_MAX_MM}
            onChange={(value) => setDimension('projectionMm', value)}
          />

          <fieldset className={styles.levelFieldset}>
            <legend>Deck level</legend>
            <div className={styles.levelOptions}>
              <label className={input.level === 'ground' ? styles.levelSelected : undefined}>
                <input type="radio" name="simple-cover-level" value="ground" checked={input.level === 'ground'} onChange={() => setLevel('ground')} />
                <span><strong>Ground level</strong><small>Up to {SIMPLE_COVER_GROUND_MAX_AREA_M2} m²</small></span>
              </label>
              <label className={input.level === 'elevated' ? styles.levelSelected : undefined}>
                <input type="radio" name="simple-cover-level" value="elevated" checked={input.level === 'elevated'} onChange={() => setLevel('elevated')} />
                <span><strong>Elevated / first floor</strong><small>Up to {SIMPLE_COVER_ELEVATED_MAX_AREA_M2} m²</small></span>
              </label>
            </div>
          </fieldset>

          <dl className={styles.fixedSpecification}>
            <div className={styles.connectionSpecification}>
              <dt><label htmlFor="simple-cover-connection">Connection</label></dt>
              <dd>
                <select
                  id="simple-cover-connection"
                  value={input.connection}
                  onChange={(event) => setConnection(event.currentTarget.value as SimpleCoverConnection)}
                >
                  {SIMPLE_COVER_CONNECTION_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </dd>
            </div>
            <div><dt>Roof</dt><dd>Pitched acrylic</dd></div>
            <div><dt>Finish</dt><dd>Standard colour</dd></div>
            <div><dt>Site</dt><dd>Normal access / easy ground</dd></div>
          </dl>
        </form>

        <div className={styles.visualColumn}>
          <ConceptPlan input={input} result={result} />
          <div className={styles.resultRegion} aria-live="polite" aria-atomic="true">
            <PricingResult input={input} result={result} pending={pending} />
          </div>
        </div>
      </div>
    </section>
  );
}
