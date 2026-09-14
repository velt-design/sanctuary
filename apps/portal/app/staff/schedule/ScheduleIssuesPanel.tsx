'use client';

import { useState } from 'react';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import styles from './schedule.module.css';

function IssueActions({ issue, item, installers, disabled, onEdit, onMove, onKeep }: {
  issue: SchedulingIssue; item: ScheduleItem; installers: Installer[]; disabled: boolean;
  onEdit: (id: string) => void; onMove: (id: string, crewId: string) => void; onKeep: (id: string, overlapKey: string) => void;
}) {
  const [crew, setCrew] = useState('');
  const adjustable = item.jobStatus !== 'done' && item.jobStatus !== 'in_progress' && item.jobStatus !== 'paused';
  return (
    <div className={styles.actionModalActions}>
      {adjustable ? <button type="button" className={styles.buttonSecondary} disabled={disabled} onClick={() => onEdit(item.id)}>Change this date</button> : null}
      {issue.relatedScheduleItemId ? <button type="button" className={styles.buttonSecondary} disabled={disabled} onClick={() => onEdit(issue.relatedScheduleItemId!)}>Change other job</button> : null}
      {adjustable ? <>
        <select aria-label="Move conflicting job to crew" value={crew} onChange={(event) => setCrew(event.target.value)} disabled={disabled}>
          <option value="">Choose another crew</option>
          {installers.filter((row) => row.active && row.id !== item.installerId).map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
        </select>
        <button type="button" className={styles.buttonSecondary} disabled={disabled || !crew} onClick={() => onMove(item.id, crew)}>Change crew</button>
      </> : null}
      {issue.overlapKey ? <button type="button" className={styles.buttonSecondary} disabled={disabled} onClick={() => onKeep(item.id, issue.overlapKey!)}>Keep overlap</button> : null}
    </div>
  );
}

export default function ScheduleIssuesPanel({ issues, items, installers, disabled, onEdit, onMove, onKeep }: {
  issues: SchedulingIssue[]; items: ScheduleItem[]; installers: Installer[]; disabled: boolean;
  onEdit: (id: string) => void; onMove: (id: string, crewId: string) => void; onKeep: (id: string, overlapKey: string) => void;
}) {
  if (!issues.length) return null;
  return (
    <details>
      <summary>{issues.length} scheduling issue{issues.length === 1 ? '' : 's'} — review and resolve</summary>
      <ul className={styles.issueList} aria-label="Scheduling issues">
        {issues.map((issue, index) => {
          const item = items.find((row) => row.id === issue.scheduleItemId);
          return <li key={`${issue.scheduleItemId}-${index}`}>
            <p>{issue.message}</p>
            {item && issue.overlapKey ? <IssueActions issue={issue} item={item} installers={installers} disabled={disabled} onEdit={onEdit} onMove={onMove} onKeep={onKeep} /> : null}
          </li>;
        })}
      </ul>
    </details>
  );
}
