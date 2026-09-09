import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3 } from 'three';
import type { GeometryPlanViewModel, Point3 } from '@sp/geometry';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import { dimensionGuide } from './dimensionGuide';
import { metres } from './model';
import styles from './prototype.module.css';

const screenCentre = (_object: unknown, _camera: unknown, size: { width: number; height: number }) => [size.width / 2, size.height / 2];

export default function PreviewDimensionGuide({ axis, plan, roof }: {
  axis: PreviewDimensionAxis; plan: GeometryPlanViewModel; roof: Point3[];
}) {
  const invalidate = useThree((state) => state.invalidate);
  const guide = useMemo(() => dimensionGuide(plan, roof, axis), [plan, roof, axis]);
  const path = useRef<SVGPathElement>(null);
  const edge = useRef<SVGPathElement>(null);
  const halo = useRef<SVGPathElement>(null);
  const label = useRef<SVGGElement>(null);
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!path.current || !edge.current || !label.current || !halo.current) return;
    const project = (p: Point3) => {
      point.set(p.x, p.y, p.z).project(camera);
      return { x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2 };
    };
    const a = project(guide.start), b = project(guide.end);
    const ea = project(guide.edgeStart), eb = project(guide.edgeEnd);
    const centre = project({ x: (plan.extents.minX + plan.extents.maxX) / 2, y: (plan.extents.minY + plan.extents.maxY) / 2, z: guide.start.z });
    const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    let nx = -(b.y - a.y) / length, ny = (b.x - a.x) / length;
    if (nx * ((a.x + b.x) / 2 - centre.x) + ny * ((a.y + b.y) / 2 - centre.y) < 0) { nx *= -1; ny *= -1; }
    const offset = size.width < 500 ? 18 : 26;
    const ax = a.x + nx * offset, ay = a.y + ny * offset;
    const bx = b.x + nx * offset, by = b.y + ny * offset;
    const edgePath = `M ${ea.x} ${ea.y} L ${eb.x} ${eb.y}`;
    edge.current.setAttribute('d', edgePath);
    halo.current.setAttribute('d', edgePath);
    path.current.setAttribute('d', `M ${a.x} ${a.y} L ${ax + nx * 5} ${ay + ny * 5} M ${b.x} ${b.y} L ${bx + nx * 5} ${by + ny * 5} M ${ax} ${ay} L ${bx} ${by}`);
    const x = Math.min(size.width - 72, Math.max(72, (ax + bx) / 2 + nx * 16));
    const y = Math.min(size.height - 24, Math.max(24, (ay + by) / 2 + ny * 16));
    label.current.setAttribute('transform', `translate(${x},${y})`);
  });
  const text = `${axis === 'width' ? 'Width' : 'Projection'} ${metres(guide.lengthMm)}`;
  return <Html fullscreen calculatePosition={screenCentre} zIndexRange={[2, 2]} style={{ pointerEvents: 'none' }}>
    <svg ref={(element) => { if (element) invalidate(); }} className={styles.dimensionOverlay} role="img" aria-label={text} data-dimension={axis}>
      <path ref={halo} fill="none" stroke="#fafbf5" strokeWidth={6} />
      <path ref={edge} fill="none" stroke="#768258" strokeWidth={3} />
      <path ref={path} fill="none" stroke="#586443" strokeWidth={1.5} />
      <g ref={label}>
        <rect x={-68} y={-15} width={136} height={30} fill="#f5f6ef" stroke="#8b967b" />
        <text textAnchor="middle" dominantBaseline="central" fill="#303b25" fontSize={13} fontFamily="Inter, sans-serif">{text}</text>
      </g>
    </svg>
  </Html>;
}
