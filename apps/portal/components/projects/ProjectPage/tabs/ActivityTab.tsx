import type { ProjectActivityItem } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

function formatTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
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
