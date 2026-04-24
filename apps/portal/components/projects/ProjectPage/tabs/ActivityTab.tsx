import type { ProjectActivityItem } from '@/lib/projects/types';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import legacy from '@/app/(portal)/staff/projects/projects.module.css';

function formatTime(value: string): string {
  return formatPortalDateTime(value);
}

export default function ActivityTab({ activity }: { activity: ProjectActivityItem[] }) {
  if (!activity.length) {
    return <p className={legacy.note}>No activity yet. Stage changes, emails, files will appear here.</p>;
  }

  return (
    <div className={legacy.tableWrap}>
      <table className={legacy.table}>
        <thead>
          <tr>
            <th>When</th>
            <th>Title</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((item) => (
            <tr key={item.id}>
              <td className={legacy.muted}>{formatTime(item.at)}</td>
              <td>{item.title}</td>
              <td className={legacy.muted}>{item.detail ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
