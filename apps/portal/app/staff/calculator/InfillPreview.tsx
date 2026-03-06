import { useEffect, useMemo, useState } from 'react';
import type { InfillLineItem } from '@/lib/types/calculator';
import styles from './CalculatorGrid.module.css';
import type { InfillComputeStatus, InfillJoinerLine, InfillResolvedOrientation } from './infillCompute';
import { brandAccentRgba } from '@sp/theme';

type InfillPreviewProps = {
  status: InfillComputeStatus;
  shape: InfillLineItem['shape'];
  orientationUsed: InfillResolvedOrientation;
  panelCountEach: number;
  unsupportedJoinerIndicesEach: number[];
  supports: InfillLineItem['support'];
  bayBoundariesM: number[];
  bayWidthsM: number[];
  joinerLines: InfillJoinerLine[];
  runSideM: number;
  acrossSideM: number;
  centreLimitM: number;
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
  bayBoundariesM,
  bayWidthsM,
  joinerLines,
  runSideM,
  acrossSideM,
  centreLimitM,
}: InfillPreviewProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const previewKey = useMemo(
    () =>
      [
        shape.type,
        shape.widthM,
        shape.type === 'rect' ? shape.heightM : shape.heightLowM,
        shape.type === 'rect' ? shape.heightM : shape.heightHighM,
        panelCountEach,
        joinerLines.map((line) => `${line.positionM.toFixed(3)}:${line.supported ? 1 : 0}`).join('|'),
      ].join('-'),
    [joinerLines, panelCountEach, shape],
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    setIsSwapping(true);
    const timeoutId = window.setTimeout(() => setIsSwapping(false), 240);
    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, previewKey]);

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
  const shapeHeight = 56;

  const leftTopY = bottomY - shapeHeight * clamp01(lowM / maxHeightM);
  const rightTopY = bottomY - shapeHeight * clamp01(highM / maxHeightM);

  const polygonPoints = `${leftX},${bottomY} ${rightX},${bottomY} ${rightX},${rightTopY} ${leftX},${leftTopY}`;
  const unsupported = new Set(unsupportedJoinerIndicesEach);

  const previewJoiners = joinerLines.map((joiner, idx) => {
    const joinerIndex = idx + 1;
    const t = acrossSideM > 0 ? clamp01(joiner.positionM / acrossSideM) : panelCountEach > 0 ? joinerIndex / panelCountEach : 0;

    if (orientationUsed === 'vertical') {
      const x = leftX + (rightX - leftX) * t;
      const topY = leftTopY + (rightTopY - leftTopY) * t;
      return {
        key: `v-${joinerIndex}`,
        x1: x,
        y1: topY,
        x2: x,
        y2: bottomY,
        unsupported: unsupported.has(joinerIndex) || !joiner.supported,
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
      unsupported: unsupported.has(joinerIndex) || !joiner.supported,
    };
  });

  const showBayLabels = bayWidthsM.length > 0 && bayWidthsM.length <= 8;
  const bayLabelNodes = showBayLabels
    ? bayWidthsM.map((width, idx) => {
        const start = bayBoundariesM[idx] ?? 0;
        const end = bayBoundariesM[idx + 1] ?? start;
        const midpoint = start + (end - start) / 2;
        const t = acrossSideM > 0 ? clamp01(midpoint / acrossSideM) : 0;
        const x = leftX + (rightX - leftX) * t;
        return (
          <text key={`bay-${idx}`} x={x} y={89} className={styles.infillPreviewLabelMinor} textAnchor="middle">
            {`${width.toFixed(2)}m`}
          </text>
        );
      })
    : null;

  const boundarySupportTicks = [
    { key: 'top', x: (leftX + rightX) / 2, y: (leftTopY + rightTopY) / 2, supported: supports.hasTop },
    { key: 'bottom', x: (leftX + rightX) / 2, y: bottomY, supported: supports.hasBottom },
    { key: 'left', x: leftX, y: (leftTopY + bottomY) / 2, supported: supports.hasLeft },
    { key: 'right', x: rightX, y: (rightTopY + bottomY) / 2, supported: supports.hasRight },
  ];

  return (
    <div className={styles.infillPreviewCard}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label="Infill layout preview"
        className={isSwapping ? `${styles.infillPreviewSvg} ${styles.infillPreviewSvgSwap}` : styles.infillPreviewSvg}
      >
        <defs>
          <linearGradient id="infill-preview-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brandAccentRgba(0.2)} />
            <stop offset="100%" stopColor={brandAccentRgba(0.06)} />
          </linearGradient>
        </defs>

        <polygon points={polygonPoints} className={styles.infillPreviewShape} fill="url(#infill-preview-fill)" />

        {previewJoiners.map((line) => (
          <line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className={line.unsupported ? styles.infillPreviewJoinerUnsupported : styles.infillPreviewJoiner}
          />
        ))}

        {previewJoiners
          .filter((line) => !line.unsupported)
          .map((line) => (
            <line
              key={`support-${line.key}`}
              x1={line.x1}
              y1={line.y2 - 3}
              x2={line.x2}
              y2={line.y2}
              className={styles.infillPreviewSupportMarker}
            />
          ))}

        <line x1={leftX} y1={leftTopY} x2={rightX} y2={rightTopY} className={supports.hasTop ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={leftX} y1={bottomY} x2={rightX} y2={bottomY} className={supports.hasBottom ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={leftX} y1={leftTopY} x2={leftX} y2={bottomY} className={supports.hasLeft ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />
        <line x1={rightX} y1={rightTopY} x2={rightX} y2={bottomY} className={supports.hasRight ? styles.infillPreviewEdge : styles.infillPreviewEdgeMissing} />

        {boundarySupportTicks.map((tick) => (
          <circle key={tick.key} cx={tick.x} cy={tick.y} r={1.2} className={tick.supported ? styles.infillPreviewSupportDot : styles.infillPreviewSupportDotMissing} />
        ))}

        <text x={(leftX + rightX) / 2} y={96} className={styles.infillPreviewLabel} textAnchor="middle">
          {`${toM(shape.widthM).toFixed(2)}m width`}
        </text>
        {shape.type === 'rect' ? (
          <text x={7} y={((leftTopY + bottomY) / 2).toFixed(2)} className={styles.infillPreviewLabel} textAnchor="start">
            {`${toM(shape.heightM).toFixed(2)}m height`}
          </text>
        ) : (
          <>
            <text x={6} y={leftTopY - 2} className={styles.infillPreviewLabelMinor}>
              {`low ${lowM.toFixed(2)}m`}
            </text>
            <text x={rightX - 12} y={rightTopY - 2} className={styles.infillPreviewLabelMinor}>
              {`high ${highM.toFixed(2)}m`}
            </text>
          </>
        )}
        <text x={rightX} y={16} className={styles.infillPreviewLabelMinor} textAnchor="end">
          {`centre ${centreLimitM.toFixed(2)}m`}
        </text>
        <text x={leftX} y={16} className={styles.infillPreviewLabelMinor}>
          {`run ${runSideM.toFixed(2)}m / across ${acrossSideM.toFixed(2)}m`}
        </text>
        {bayLabelNodes}
      </svg>

      <div className={styles.infillPreviewLegend}>
        <span>Preview</span>
        <span>{orientationUsed === 'vertical' ? 'Vertical joiners' : 'Horizontal joiners'}</span>
      </div>
    </div>
  );
}
