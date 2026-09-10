'use client';

import {useRail} from './RailProvider';
import BlindControls from './BlindControls';
import RoofBattenControls from './RoofBattenControls';
import RoofFinishChoices from "./RoofFinishChoices";
import { previewProjectionMax } from "./roofFinish";

import { useState, type CSSProperties } from 'react';
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import {
  SIMPLE_COVER_WIDTH_MIN_MM, SIMPLE_COVER_WIDTH_MAX_MM,
  SIMPLE_COVER_PROJECTION_MIN_MM, SIMPLE_COVER_PROJECTION_MAX_MM,
  type SimpleCoverInput,
} from '../../lib/simpleCoverCalculator';
import { constrainPreviewConnection, metres, PREVIEW_SOFFIT_MAX_PROJECTION_MM } from './model';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import AttachmentChoices from './AttachmentChoices';
import styles from './prototype.module.css';
import slider from '../simple-cover-calculator/SimpleCoverCalculator.module.css';
import GableChoices, { RoofTypeChoice, type PreviewRoofChoices } from './GableChoices';

function Dimension({ axis, label, value, min, max, onChange, onActivity }: {
  axis: PreviewDimensionAxis; label: string; value: number; min: number; max: number; onChange: (value: number) => void;
  onActivity: (axis: PreviewDimensionAxis | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const marks = [min, ...Array.from({ length: Math.ceil(max / 1000) }, (_, i) => i * 1000).filter(mark => mark >= min + 750 && mark <= max - 750), max];
  function commit() {
    const text = draft ?? (value / 1000).toFixed(1);
    const number = Number(text);
    const next = text.trim() && Number.isFinite(number)
      ? Math.min(max, Math.max(min, Math.round(number * 10) * 100)) : value;
    setNotice(!text.trim() || !Number.isFinite(number) ? 'Enter a size in metres.'
      : number * 1000 < min || number * 1000 > max ? `Choose ${metres(min)}–${metres(max)}.` : '');
    if (next !== value) onChange(next);
    setDraft(null);
  }
  return <div className={styles.dimension}
    onFocusCapture={() => onActivity(axis)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActivity(null); }}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') onActivity(axis); }}
    onPointerDown={() => onActivity(axis)}
    onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) onActivity(null); }}>
    <div className={slider.dimensionHeading}>
      <label htmlFor={`range-${label}`}>{label}</label>
      <label className={slider.dimensionValue}><input aria-label={`${label} in metres`} inputMode="decimal" value={draft ?? (value / 1000).toFixed(1)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => { setDraft(event.target.value); setNotice(''); }} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>m</span></label>
    </div>
    <div className={slider.rangeControl} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties}>
    <input className={slider.range} id={`range-${label}`} type="range" min={min} max={max} step={100} value={value}
      aria-valuetext={metres(value)} onChange={(event) => { setDraft(null); setNotice(''); onChange(Number(event.target.value)); }} />
    <div className={slider.rangeRail} aria-hidden="true">{marks.map((mark, index) => <span key={mark} className={slider.rangeStop}
      data-terminal={index === 0 || index === marks.length - 1 ? 'true' : undefined}
      style={{ left: `${(mark - min) / (max - min) * 100}%` }}>{mark / 1000}</span>)}</div>
    </div>
    {notice && <p className={styles.inputNotice}>{notice}</p>}
  </div>;
}

export default function PreviewControls({ input, roof, onRoofChange, onChange, onDimensionActivity }: {
  roof: PreviewRoofChoices; onRoofChange: (roof: PreviewRoofChoices) => void;
  input: SimpleCoverInput; onChange: (input: SimpleCoverInput) => void;
  onDimensionActivity: (axis: PreviewDimensionAxis | null) => void;
}) {
  const {section}=useRail();
  const [connectionNotice, setConnectionNotice] = useState('');
  const [projectionNotice, setProjectionNotice] = useState('');
  const projectionMax = previewProjectionMax(roof);
  function updateRoof(next: PreviewRoofChoices) {
    const max = previewProjectionMax(next);
    setProjectionNotice(input.projectionMm > max ? `Projection adjusted to ${metres(max)} for this roof.` : '');
    onRoofChange(next);
  }
  const soffitUnavailable = input.projectionMm > PREVIEW_SOFFIT_MAX_PROJECTION_MM;
  function update(next: SimpleCoverInput) {
    setProjectionNotice('');
    const valid = constrainPreviewConnection(next, roof.family);
    setConnectionNotice(valid.connection !== next.connection ? `Switched to ${valid.connection}. ` : '');
    onChange(valid);
  }
  return <div className={styles.controls}>
    <div hidden={section!=='structure'}>
    <div className={styles.sectionLabel}><h2>Size & shape</h2></div>
    <RoofTypeChoice value={roof} onChange={updateRoof} />
    <div className={styles.dimensions}>
    <Dimension axis="width" onActivity={onDimensionActivity} label="Width" value={input.widthMm} min={Math.max(SIMPLE_COVER_WIDTH_MIN_MM, CUSTOMER_DIMENSION_BOUNDS.lengthMm.minimum)} max={SIMPLE_COVER_WIDTH_MAX_MM}
      onChange={(widthMm) => update({ ...input, widthMm })} />
    <Dimension key={projectionMax} axis="projection" onActivity={onDimensionActivity} label="Projection" value={input.projectionMm} min={Math.max(SIMPLE_COVER_PROJECTION_MIN_MM, CUSTOMER_DIMENSION_BOUNDS.projectionMm.minimum)} max={projectionMax}
      onChange={(projectionMm) => update({ ...input, projectionMm })} />
    </div>
    {projectionMax < SIMPLE_COVER_PROJECTION_MAX_MM && <p className={styles.inputNotice}>Maximum projection for this roof: {metres(projectionMax)}.</p>}
    {projectionNotice && <p className={styles.inputNotice} role="status">{projectionNotice}</p>}
    <GableChoices value={roof} onChange={updateRoof} />
    <div className={styles.sectionLabel}><h2>House connection</h2></div>
    {roof.family === 'gable' && roof.orientation === 'away' ? <p className={styles.small}>Fascia attachment · Dutch-gable roof</p>
      : <><AttachmentChoices key={roof.family} allowFascia={roof.family !== 'box'} value={input.connection} soffitUnavailable={soffitUnavailable} onChange={connection => update({ ...input, connection })} />
    {soffitUnavailable && <p className={styles.inputNotice} role="status">{connectionNotice}Soffit brackets are available up to 4.0 m projection.</p>}</>}
    <fieldset className={styles.choices}><legend>Site level</legend>
      {(['ground', 'elevated'] as const).map((level) => <label key={level} data-selected={input.level === level}>
        <input type="radio" name="level" value={level} checked={input.level === level}
          onChange={() => update({ ...input, level })} />{level === 'ground' ? 'Ground level' : 'Elevated'}
      </label>)}
    </fieldset>
    {input.level === 'elevated' && <p className={styles.small}>First-floor deck · shown 2.7 m above ground.</p>}
    </div>
    <div hidden={section!=='roof'}><div className={styles.sectionLabel}><h2>Roof & ceiling</h2></div>
    <RoofFinishChoices roof={roof} input={input} onChange={updateRoof} />
    <RoofBattenControls roof={roof} onChange={updateRoof} />
    {roof.family === 'box' && <div className={styles.gableChoices}><p className={styles.small}>A level frame with the roof tucked inside. The roof changes to a shallow gable when needed to maintain drainage.</p></div>}
</div>
    <div hidden={section!=='sides'}><BlindControls /></div>

  </div>;
}
