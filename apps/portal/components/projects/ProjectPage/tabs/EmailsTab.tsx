import type { ProjectEmailLog } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

function formatTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

export default function EmailsTab({ emails }: { emails: ProjectEmailLog[] }) {
  if (!emails.length) {
    return <p className={legacy.note}>No emails recorded yet. Automated emails sent to the client will appear here.</p>;
  }

  return (
    <div className={legacy.tableWrap}>
      <table className={legacy.table}>
        <thead>
          <tr>
            <th>To</th>
            <th>Subject</th>
            <th>Sent</th>
            <th>Status</th>
            <th>Kind</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id}>
              <td className={legacy.muted}>{email.toEmail || '—'}</td>
              <td>{email.subject || 'Untitled email'}</td>
              <td className={legacy.muted}>{formatTime(email.sentAt)}</td>
              <td>{email.status ?? '—'}</td>
              <td className={legacy.muted}>{email.kind ? email.kind.replace(/_/g, ' ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
