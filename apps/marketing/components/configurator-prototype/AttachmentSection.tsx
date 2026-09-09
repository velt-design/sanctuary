import { useMemo } from 'react';
import type { SimpleCoverConnection } from '../../lib/simpleCoverCalculator';
import { INITIAL_INPUT } from './model';
import { solvePergolaPreview, solveSimpleCoverSurroundings } from './solvePreview';
import { INITIAL_ROOF } from './GableChoices';

/** Side-section illustration from the same reference geometry as the 3D context. */
export default function AttachmentSection({ connection, boxPerimeter = false }: { connection: SimpleCoverConnection; boxPerimeter?: boolean }) {
  const context = useMemo(() => {
    const input = { ...INITIAL_INPUT, connection };
    const roof = {...INITIAL_ROOF,family:boxPerimeter ? 'box' as const : 'mono' as const};
    const artifact = solvePergolaPreview(input,roof);
    return 'geometry' in artifact && artifact.geometry ? solveSimpleCoverSurroundings(input, artifact.geometry.assembly,roof) : null;
  }, [connection,boxPerimeter]);
  if (!context) return null;
  const { ledger, wall, roof, roofEnclosure, gutter, brackets } = context;
  const left = wall.max.y - 180;
  const right = ledger.backY + 420;
  const bottom = ledger.bottomZ - 340;
  const top = ledger.topZ + 270;
  const scale = Math.min(280 / (right - left), 170 / (top - bottom));
  const x = (y: number) => 16 + (y - left) * scale;
  const y = (z: number) => 14 + (top - z) * scale;
  const points = (section: { y: number; z: number }[]) => section.map(p => `${x(p.y)},${y(p.z)}`).join(' ');
  const ledgerX = x(ledger.backY);
  const ledgerY = y(ledger.topZ);
  return <svg viewBox="0 0 312 210" role="img" aria-label={`${connection === 'soffit' ? 'Soffit bracket supporting the ledger from underneath' : connection === 'fascia' ? 'Ledger against fascia beneath the gutter' : 'Ledger against the lower part of a two-storey wall'} — side section`}>
    <defs><clipPath id={`section-clip-${connection}`}><rect x="10" y="8" width="292" height="178" rx="2" /></clipPath></defs>
    <g clipPath={`url(#section-clip-${connection})`}>
      <rect x={x(wall.min.y)} y={y(wall.max.z)} width={(wall.max.y - wall.min.y) * scale} height={(wall.max.z - bottom + 500) * scale} fill="#dddccf" />
      <polygon points={points(roofEnclosure.section)} fill="#e7e6dc" stroke="#bec4b6" strokeWidth=".8" />
      <polygon points={points(roof.section)} fill="#b9c2b0" />
      <polygon points={points(gutter.section)} fill="#9ca995" />
      {brackets[0] && <polygon points={points(brackets[0].section)} fill="#66745a" stroke="#43523c" strokeWidth=".8" />}
      <path d={`M ${x(ledger.backY + 50)} ${ledgerY} L 310 ${ledgerY + 27} L 310 ${ledgerY + 37} L ${x(ledger.backY + 50)} ${ledgerY + 10} Z`} fill="#89937f" opacity=".65" />
      <rect x={ledgerX} y={ledgerY} width={50 * scale} height={(ledger.topZ - ledger.bottomZ) * scale} fill="#303d2b" />
    </g>
    <g fontFamily="Inter, sans-serif" fontSize="10" fill="#4c5944">
      <path d={`M ${ledgerX + 7} ${ledgerY + 12} L ${ledgerX + 42} ${ledgerY - 18} H ${ledgerX + 77}`} fill="none" stroke="#66745a" strokeWidth=".8" />
      <text x={ledgerX + 45} y={ledgerY - 23}>Ledger</text>
      {connection === 'soffit' && <><path d={`M ${x(-280)} ${y(context.fascia.min.z - 20)} V 170`} stroke="#66745a" strokeWidth=".8" /><text x="18" y="182">40 mm SHS bracket</text></>}
      {connection === 'facade' && <text x="18" y="22">↑ Wall continues to upper storey</text>}
      <text x="16" y="203" fontSize="9" fill="#858b7e">SIDE DETAIL · REPRESENTATIVE</text>
    </g>
  </svg>;
}
