'use client';
import { useId, useState, type CSSProperties } from 'react';
import css from './dimension-control.module.css';
const metres = (value: number) => `${(value / 1000).toFixed(1)} m`;

export default function DimensionControl({ axis, label, value, min, max, onChange, onActivity = () => {} }: {
  axis: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void;
  onActivity?: (axis: string | null) => void;
}) {
  const controlId = useId();
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
  return <div className={css.dimension} data-dimension={axis}
    onFocusCapture={() => onActivity(axis)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActivity(null); }}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') onActivity(axis); }}
    onPointerDown={() => onActivity(axis)}
    onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) onActivity(null); }}>
    <div className={css.dimensionHeading}>
      <label htmlFor={`range-${controlId}`}>{label}</label>
      <label className={css.dimensionValue}><input aria-label={`${label} in metres`} inputMode="decimal" value={draft ?? (value / 1000).toFixed(1)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => { setDraft(event.target.value); setNotice(''); }} onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>m</span></label>
    </div>
    <div className={css.rangeControl} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties}>
    <input className={css.range} id={`range-${controlId}`} type="range" min={min} max={max} step={100} value={value}
      aria-valuetext={metres(value)} onChange={(event) => { setDraft(null); setNotice(''); onChange(Number(event.target.value)); }} />
    <div className={css.rangeRail} aria-hidden="true">{marks.map((mark, index) => <span key={mark} className={css.rangeStop}
      data-terminal={index === 0 || index === marks.length - 1 ? 'true' : undefined}
      style={{ left: `${(mark - min) / (max - min) * 100}%` }}>{mark / 1000}</span>)}</div>
    </div>
    <p className={css.inputNotice} role="status">{notice || ' '}</p>
  </div>;
}
