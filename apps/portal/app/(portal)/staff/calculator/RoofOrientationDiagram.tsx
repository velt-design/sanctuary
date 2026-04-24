import styles from './CalculatorGrid.module.css';

export default function RoofOrientationDiagram() {
  return (
    <div className={styles.roofDiagram} aria-label="Roof orientation diagram">
      <svg viewBox="0 0 240 140" role="img" aria-hidden="true" focusable="false">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(var(--portal-text-rgb), 0.75)" />
          </marker>
        </defs>

        <rect x="70" y="45" width="140" height="75" rx="8" fill="rgba(var(--portal-text-rgb), 0.03)" stroke="rgba(var(--portal-text-rgb), 0.22)" />

        <line x1="70" y1="26" x2="210" y2="26" stroke="rgba(var(--portal-text-rgb), 0.75)" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="140" y="18" textAnchor="middle" fontSize="12" fill="rgba(var(--portal-text-rgb), 0.75)">
          Roof Length
        </text>

        <line x1="48" y1="45" x2="48" y2="120" stroke="rgba(var(--portal-text-rgb), 0.75)" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
        <text x="28" y="84" textAnchor="middle" fontSize="12" fill="rgba(var(--portal-text-rgb), 0.75)" transform="rotate(-90 28 84)">
          Roof Span
        </text>
      </svg>
    </div>
  );
}
