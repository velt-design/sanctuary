'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectEmailLog } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';

function formatTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

export default function EmailsTab({ projectId, emails }: { projectId: string; emails: ProjectEmailLog[] }) {
  const initial = useMemo(() => (emails.length ? emails[0].id : ''), [emails]);
  const [selectedId, setSelectedId] = useState<string>(initial);

  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId((prev) => (prev ? prev : initial));
  }, [initial]);

  useEffect(() => {
    if (!selectedId) return;

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/staff/v1/projects/${encodeURIComponent(projectId)}/emails/${encodeURIComponent(selectedId)}/preview`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = typeof body?.error === 'string' ? body.error : 'Failed to load preview';
          throw new Error(msg);
        }
        setHtml(typeof body?.html === 'string' ? body.html : '');
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load preview');
        setHtml('');
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoading(false);
      });

    return () => ac.abort();
  }, [projectId, selectedId]);

  if (!emails.length) {
    return <p className={legacy.note}>No emails recorded yet. Automated emails sent to the client will appear here.</p>;
  }

  return (
    <div>
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
            {emails.map((email) => {
              const isActive = email.id === selectedId;
              return (
                <tr
                  key={email.id}
                  className={legacy.rowClickable}
                  onClick={() => setSelectedId(email.id)}
                  style={isActive ? { outline: '2px solid rgba(129, 63, 57, 0.35)', outlineOffset: '-2px' } : undefined}
                >
                  <td className={legacy.muted}>{email.toEmail || '—'}</td>
                  <td>{email.subject || 'Untitled email'}</td>
                  <td className={legacy.muted}>{formatTime(email.sentAt)}</td>
                  <td>{email.status ?? '—'}</td>
                  <td className={legacy.muted}>{email.kind ? email.kind.replace(/_/g, ' ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className={legacy.tableWrap} style={{ height: 520, overflow: 'hidden' }}>
          {loading ? <p className={legacy.note}>Loading preview…</p> : null}
          {error ? <p className={legacy.note}>{error}</p> : null}
          {!loading && !error && !html ? <p className={legacy.note}>Select an email to preview.</p> : null}

          {!loading && !error && html ? (
            <iframe
              title="Email preview"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              style={{ width: '100%', height: 520, border: 0, background: '#fff' }}
              srcDoc={html}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
