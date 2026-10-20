import type { websiteComposition } from '@/lib/designStudio/websiteComposition';
import { studioConnectionPresentation } from '@/lib/designStudio/studioConnectionPresentation';
import { studioProductIssue } from '@/lib/designStudio/studioProductIssue';
import css from './StudioConnection.module.css';

export default function StudioConnectionStatus({ row, houseLabel, onConnection, onRepairSelection }: {
  row: ReturnType<typeof websiteComposition>[number]; houseLabel?: string; onConnection: () => void; onRepairSelection?:()=>void;
}) {
  const state = studioConnectionPresentation(row, houseLabel);
  const issue = studioProductIssue(row);
  return <div className={css.status} aria-label="Applied house connection">
    <strong>{state.state}</strong><span>{state.detail}</span>{state.height && <small>{state.height}</small>}
    {issue&&onRepairSelection?<button onClick={onRepairSelection}>{issue.label}</button>:<button onClick={onConnection}>{row.studioAttachment ? 'Change connection' : 'Connect to house'}</button>}
  </div>;
}
