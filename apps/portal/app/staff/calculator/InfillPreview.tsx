import type { InfillLineItem } from '@/lib/types/calculator';
import styles from './CalculatorGrid.module.css';
import type { InfillComputeStatus, InfillResolvedOrientation } from './infillCompute';

type InfillPreviewProps = {
  status: InfillComputeStatus;
  shape: InfillLineItem['shape'];
  orientationUsed: InfillResolvedOrientation;
  panelCountEach: number;
  unsupportedJoinerIndicesEach: number[];
  supports: InfillLineItem['support'];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toM(value: string): number {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export default function InfillPreview({
  status,
  shape,
  orientationUsed,
  panelCountEach,
  unsupportedJoinerIndicesEach,
  supports,
}: InfillPreviewProps) {
  if (status === 'draft') {
    return <div className={styles.infillPreviewPlaceholder}>Incomplete</div>;
  }

  const widthM = Math.max(0.1, toM(shape.widthM));
  const lowM = shape.type === 'rect' ? toM(shape.heightM) : toM(shape.heightLowM);
  const highM = shape.type === 'rect' ? toM(shape.heightM) : toM(shape.heightHighM);
  const maxHeightM = Math.max(0.1, lowM, highM);

  const leftX = 10;
  const rightX = 90;
  const bottomY = 84;
  const topBand = 24;
  const shapeHeight = 56;

  const leftTopY = bottomY - shapeHeight * clamp01(lowM / maxHeightM);
  const rightTopY = bottomY - shapeHeight * clamp01(highM / maxHeightM);

  const polygonPoints = `${leftX},${bottomY} ${rightX},${bottomY} ${rightX},${rightTopY} ${leftX},${leftTopY}`;
  const internalJoinerCount = Math.max(0, panelCountEach - 1);
  const unsupported = new Set(unsupportedJoinerIndicesEach);

  const joinerLines = Array.from({ length: internalJoinerCount }, (_, idx) => {
    const joinerIndex = idx + 1;
    const t = panelCountEach > 0 ? joinerIndex / panelCountEach : 0;

    if (orientationUsed === 'vertical') {
      const x = leftX + (rightX - leftX) * t;
      const topY = leftTopY + (rightTopY - leftTopY) * t;
      return {
        key: `v-${joinerIndex}`,
        x1: x,
        y1: topY,
        x2: x,
        y2: bottomY,
        unsupported: unsupported.has(joinerIndex),
      };
    }

    const topY = Math.min(leftTopY, rightTopY);
    const y = topY + (bottomY - topY) * t;
    return {
      key: `h-${joinerIndex}`,
      x1: leftX,
      y1: y,
      x2: rightX,
      y2: y,
      unsupported: unsupported.has(joinerIndex),
    };
  });

  return (
    <div className={styles.infillPreviewCard}>
      <svg viewBox="0 0 100 100" role="img" aria-label="Infill layout preview" className={styles.infillPreviewSvg}>
        <defs>
          <linearGradient id="infill-preview-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(129,63,57,0.2)" />
            <stop offset="100%" stopColor="rgba(129,63,57,0.06)" />
          </linearGradient>
        </defs>

        <polygon points={polygonPoints} className={styles.infillPreviewShape} fill="url(#infill-preview-fill)" />

        {joinerLines.map((line) => (
          <line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={line.unsupported ? styles.infillPreviewJoinerUnsupported : styles.infillPreviewJoiner}
          />
        ))}

        <line x1={leftX} y1={leftTopY} x2={rightX} y2={rightTopY} className={supports.hasTop ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={leftX} y1={bottomY} x2={rightX} y2={bottomY} className={supports.hasBottom ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={leftX} y1={leftTopY} x2={leftX} y2={bottomY} className={supports.hasLeft ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={rightX} y1={rightTopY} x2={rightX} y2={bottomY} className={supports.hasRight ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
      </svg>

      <div className={styles.infillPreviewLegend}>
        <span>Preview</span>
        <span>{orientationUsed === 'vertical' ? 'Vertical joiners' : 'Horizontal joiners'}</span>
      </div>
    </div>
  );
}

