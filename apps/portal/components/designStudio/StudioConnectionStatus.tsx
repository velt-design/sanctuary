import type { websiteComposition } from '@/lib/designStudio/websiteComposition';
import { studioConnectionPresentation } from '@/lib/designStudio/studioConnectionPresentation';
import css from './StudioConnection.module.css';

export default function StudioConnectionStatus({ row, houseLabel, onConnection }: {
  row: ReturnType<typeof websiteComposition>[number]; houseLabel?: string; onConnection: () => void;
}) {
  const state = studioConnectionPresentation(row, houseLabel);
  return <div className={css.status} aria-label="Applied house connection">
    <strong>{state.state}</strong><span>{state.detail}</span>{state.height && <small>{state.height}</small>}
    <button onClick={onConnection}>{row.studioAttachment ? 'Inspect connection' : 'Connect to house'}</button>
  </div>;
}
