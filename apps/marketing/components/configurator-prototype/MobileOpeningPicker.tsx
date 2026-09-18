'use client';
import { usePreviewBlinds } from './PreviewBlindProvider';
import BlindPlan from './BlindPlan';

/** A quiet footprint using the same solved openings and selection owner as 3D. */
export default function MobileOpeningPicker({ freestanding, selectedIds, onToggle }: { freestanding: boolean; selectedIds?: string[]; onToggle?: (id: string) => void }) {
  const { openings } = usePreviewBlinds()!;
  if (!openings.length) return <p>No sides are available for this design.</p>;
  const xs = openings.flatMap(o => [o.start.x, o.end.x]);
  const ys = openings.flatMap(o => [o.start.y, o.end.y]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(180 / Math.max(1, maxX - minX), 160 / Math.max(1, maxY - minY));
  const width = (maxX - minX) * scale, height = (maxY - minY) * scale;
  const x = (340 - width) / 2, y = (300 - height) / 2;
  return <svg viewBox="0 0 340 300" role="group" aria-label="Choose a side of your pergola" data-opening-picker>
    <text x="170" y="20" textAnchor="middle" fontSize="11" fill="currentColor">{freestanding ? 'BACK' : 'YOUR HOME'}</text>
    {!freestanding && <path d={`M${x} 33H${x + width}`} stroke="currentColor" strokeWidth="3" />}
    <rect x={x} y={y} width={width} height={height} fill="#e3e5dc" stroke="#adb3a4" />
    <text x="170" y="150" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#616957">Your pergola</text>
    <g transform={`translate(${x - minX * scale},${y - minY * scale}) scale(${scale})`}><BlindPlan scale={scale} guided selectedIds={selectedIds} onToggle={onToggle} /></g>
  </svg>;
}
