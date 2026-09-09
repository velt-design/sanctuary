'use client';

import { useEffect, useState } from 'react';
import { dismissPendingScheduleRequest, readPendingScheduleRequests, subscribePendingScheduleRequests, type PendingScheduleRequest } from '@/lib/scheduling/schedulePendingRequests';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import styles from './schedule.module.css';

const labels: Record<string, string> = {
  'board/placement': 'Move in schedule', 'overlap/keep': 'Keep overlap',
  'job/assign': 'Move to crew', 'job/unassign': 'Unschedule', 'items/reorder': 'Change queue order',
  'job/set-duration': 'Change duration', 'job/pin': 'Fix start date', 'job/adjust': 'Change dates', 'job/unpin': 'Make dates flexible',
  'downtime/create': 'Add downtime', 'downtime/update': 'Change downtime', 'downtime/delete': 'Remove downtime',
  'job/mark-in-progress': 'Mark started', 'job/set-days-remaining': 'Update remaining days', 'job/mark-done': 'Mark completed',
  'job/lock': 'Set commitment', 'job/reschedule': 'Change commitment', 'job/client-update/ack': 'Mark client contacted',
};
const fieldLabels: Record<string, string> = {
  requested_start_date: 'Start', forecast_duration_days: 'Working days', days_remaining: 'Remaining days',
  start_date: 'Start', week_of_date: 'Week of', duration_days: 'Working days', position: 'Queue position', destination: 'Destination', note: 'Note', reason: 'Reason',
};

export default function SchedulePendingChanges({ items, installers, projectsById, onReview, onRefresh }: {
  items: ScheduleItem[]; installers: Installer[]; projectsById: Map<string, ScheduleProjectSummary>;
  onReview: (itemId: string, request: PendingScheduleRequest) => void; onRefresh: () => void;
}) {
  const [pending, setPending] = useState<PendingScheduleRequest[]>([]);
  useEffect(() => {
    const read = () => setPending(readPendingScheduleRequests());
    read();
    return subscribePendingScheduleRequests(read);
  }, []);
  if (!pending.length) return null;
  return (
    <details>
      <summary>{pending.length} change{pending.length === 1 ? '' : 's'} to check</summary>
      <p className={styles.hint}>Your requests are retained in this browser. Refresh and check the saved dates before applying them again.</p>
      <button type="button" className={styles.buttonSecondary} onClick={onRefresh}>Refresh saved schedule</button>
      <ul className={styles.issueList}>
        {pending.map((entry) => {
          const jobId = typeof entry.input.job_id === 'string' ? entry.input.job_id : null;
          const itemId = typeof entry.input.item_id === 'string' ? entry.input.item_id : null;
          const downtimeId = typeof entry.input.downtime_id === 'string' ? entry.input.downtime_id : null;
          const item = items.find((row) =>
            (jobId && (row.scheduledJobId === jobId || row.projectId === jobId || row.projectId === `proj_${jobId}`)) ||
            (itemId && (row.id === itemId || row.id === `sch_${itemId}`)) ||
            (downtimeId && row.downtimeId === downtimeId));
          const projectId = item?.projectId ?? (jobId ? jobId.startsWith('proj_') ? jobId : `proj_${jobId}` : null);
          const project = projectId ? projectsById.get(projectId) : null;
          const crewId = entry.input.crew_id;
          const crew = typeof crewId === 'string' ? installers.find((row) => row.id === crewId || row.id === `crew_${crewId}`) : null;
          const action = labels[entry.path.replace('/api/staff/v1/schedule/', '')] ?? 'Schedule change';
          return (
            <li key={entry.id}>
              <strong>{project?.projectName ?? project?.name ?? 'Schedule'}: {action}</strong>
              <p>{entry.state === 'rejected' ? 'Not saved.' : 'Save not confirmed; it may already have saved.'} {entry.message}</p>
              {crew ? <p>Crew: {crew.name}</p> : null}
              <p style={{ overflowWrap: 'anywhere' }}>{Object.entries(fieldLabels).filter(([key]) => entry.input[key] !== undefined).map(([key, label]) => `${label}: ${String(key === 'position' && typeof entry.input[key] === 'number' ? entry.input[key] + 1 : entry.input[key])}`).join(' · ')}</p>
              {item && item.itemType !== 'downtime' ? <button type="button" className={styles.buttonSecondary} onClick={() => onReview(item.id, entry)}>Review job</button> : project && projectId ? <a className={styles.buttonSecondary} href={`/staff/projects/${encodeURIComponent(projectId)}`}>Review project</a> : null}
              <button type="button" className={styles.buttonSecondary} onClick={() => { dismissPendingScheduleRequest(entry.id); setPending(readPendingScheduleRequests()); }}>Checked — dismiss request</button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
