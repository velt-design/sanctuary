import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SIMPLE_COVER_CONNECTION_OPTIONS, type SimpleCoverConnection } from '../../lib/simpleCoverCalculator';
import AttachmentSection from './AttachmentSection';
import styles from './attachmentDetails.module.css';

const DESCRIPTIONS: Record<SimpleCoverConnection, string> = {
  fascia: 'The ledger fixes against the fascia, beneath your existing gutter.',
  soffit: 'L-shaped brackets support the ledger from underneath. Its top aligns with the gutter, with 5 mm clearance.',
  facade: 'The ledger fixes directly to the wall, typically at the lower level of a two-storey home.',
};

export default function AttachmentChoices({ value, soffitUnavailable, onChange, allowFascia = true }: {
  value: SimpleCoverConnection; soffitUnavailable: boolean; onChange: (value: SimpleCoverConnection) => void; allowFascia?: boolean;
}) {
  const [active, setActive] = useState<SimpleCoverConnection | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const anchors = useRef<Partial<Record<SimpleCoverConnection, HTMLDivElement | null>>>({});
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  const closeSoon = () => { cancel(); timer.current = setTimeout(() => setActive(null), 180); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const anchor = anchors.current[active]?.getBoundingClientRect();
      const panel = card.current;
      if (!anchor || !panel) return;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const left = anchor.left > width + 24 ? anchor.left - width - 12 : Math.max(12, Math.min(innerWidth - width - 12, anchor.left));
      const desiredTop = anchor.left > width + 24 ? anchor.top - 60 : anchor.top - height - 12;
      setPosition({ left, top: Math.max(12, Math.min(innerHeight - height - 12, desiredTop)) });
    };
    place();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !card.current?.contains(event.target) && !anchors.current[active]?.contains(event.target)) setActive(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActive(null); anchors.current[active]?.querySelector('button')?.focus(); } };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
    };
  }, [active]);
  const label = SIMPLE_COVER_CONNECTION_OPTIONS.find(option => option.value === active)?.label;
  return <fieldset className={styles.options}><legend>Attachment</legend>
    {SIMPLE_COVER_CONNECTION_OPTIONS.filter(option => allowFascia || option.value !== 'fascia').map(option => <div className={styles.option} key={option.value}
      ref={element => { anchors.current[option.value] = element; }} data-selected={value === option.value}
      onPointerEnter={event => { if (event.pointerType === 'mouse') { cancel(); timer.current = setTimeout(() => setActive(option.value), 220); } }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') closeSoon(); }}>
      <label><input type="radio" name="attachment" value={option.value} checked={value === option.value}
        disabled={option.value === 'soffit' && soffitUnavailable} onChange={() => onChange(option.value)} />{option.label}</label>
      <button type="button" aria-label={`About ${option.label} attachment`} aria-expanded={active === option.value}
        onClick={() => { cancel(); setActive(current => current === option.value ? null : option.value); }}><span aria-hidden="true">i</span></button>
    </div>)}
    {active && createPortal(<div ref={card} className={styles.card} style={position} role="dialog" aria-label={`${label} attachment detail`}
      onPointerEnter={cancel} onPointerLeave={event => { if (event.pointerType === 'mouse') closeSoon(); }}>
      <div className={styles.heading}><strong>{label}</strong><button type="button" aria-label="Close attachment detail" onClick={() => setActive(null)}>×</button></div>
      <AttachmentSection connection={active} boxPerimeter={!allowFascia} />
      <p>{DESCRIPTIONS[active]}</p>
      {active === 'soffit' && <small>Available up to 4.0 m projection.</small>}
    </div>, document.body)}
  </fieldset>;
}
