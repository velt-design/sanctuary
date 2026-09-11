'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { invalidateProjectWorkReads } from '@/lib/queries/projectWorkCache';
import { invalidateProjectsIndexCaches } from '@/lib/queries/projectCache';
import { PipelineModal } from '@/components/ui/PipelineModal';
import { AlertBanner, Button, Input, Textarea } from '@/components/ui/foundation';

type DeliveryStatus = {
  scheduled: boolean; completed: boolean; archived: boolean; completedDate: string | null;
  confirmationId: string | null; closureBlockers: string[];
};
type ScheduleResponse = {
  ok?: boolean; requires_finish_early?: boolean; freed_days?: number; requires_confirmation?: boolean;
  impacts?: Array<{ before_start: string | null; after_start: string | null }>;
};

export default function ProjectDeliveryAction({ projectId, host, completed = false, disabled = false, onRefresh }: {
  projectId: string; host: string; completed?: boolean; disabled?: boolean; onRefresh?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const commandId = useRef('');
  const finishEarlyChoice = useRef<'pull_forward' | 'keep_schedule' | undefined>(undefined);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [prompt, setPrompt] = useState<ScheduleResponse | null>(null);
  const path = '/api/staff/v1/projects/' + encodeURIComponent(projectId) + '/delivery';

  async function load() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setOpen(true); setSaved(false); setPrompt(null); setStatus(null);
    commandId.current = crypto.randomUUID();
    finishEarlyChoice.current = undefined;
    try {
      setStatus(await apiJson<DeliveryStatus>(path));
      setDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
      setNote('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load delivery.'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function save(options: { force?: boolean; finishEarlyAction?: 'pull_forward' | 'keep_schedule' } = {}) {
    if (lock.current || !status || saved) return;
    lock.current = true; setBusy(true); setError('');
    if (options.finishEarlyAction) finishEarlyChoice.current = options.finishEarlyAction;
    try {
      const response = await apiJson<ScheduleResponse>(path, {
        method: 'POST', body: JSON.stringify({
          commandId: commandId.current, action: status.completed ? 'reopen' : 'complete',
          completedDate: date, note, finishEarlyAction: finishEarlyChoice.current, ...options,
        }),
      });
      if (response.requires_finish_early || response.requires_confirmation) { setPrompt(response); return; }
      if (!response.ok) throw new Error('Completion was not confirmed. Refresh before retrying.');
      setSaved(true); setPrompt(null);
      await Promise.all([
        invalidateProjectWorkReads(queryClient, host, projectId),
        invalidateProjectsIndexCaches(queryClient, host),
        queryClient.invalidateQueries({ queryKey: ['runningJobs', host] }),
        queryClient.invalidateQueries({ queryKey: ['schedule', host] }),
      ]);
      onRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save delivery.'); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Button type="button" variant="secondary" size="small" disabled={disabled} onClick={() => void load()}>
        {completed ? 'Delivery completed' : 'Mark delivery completed'}
      </Button>
      <PipelineModal open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}
        title={completed ? 'Delivery completion' : 'Mark delivery completed'}
        description="Delivery completion does not record payment or archive this project."
        actions={<Button type="button" variant="tertiary" disabled={busy} onClick={() => setOpen(false)}>Close</Button>}>
        {error ? <AlertBanner tone="error" title={saved ? 'Saved; refresh required' : 'Delivery could not be updated'}>{error}</AlertBanner> : null}
        {saved ? <AlertBanner tone="info" title="Delivery updated">The delivery change is saved. Payment records remain separate.</AlertBanner> : null}
        {busy ? <p>Loading...</p> : null}
        {!busy && !status ? <Button onClick={() => void load()}>Retry</Button> : null}
        {status && !saved ? <>
          {status.completed ? <p>Completed: {status.completedDate}. {status.scheduled ? 'You can reopen this installation.' : 'An admin can correct the delivery confirmation in project work controls.'}</p> : null}
          {!status.scheduled && !status.completed ? <>
            <Input label="Completion date" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
            <Textarea label="Completion note" value={note} maxLength={500} disabled={busy} onChange={(e) => setNote(e.target.value)} />
          </> : null}
          {status.closureBlockers.length ? <AlertBanner tone="info" title="Financial closure">
            <ul>{status.closureBlockers.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </AlertBanner> : null}
          {prompt?.impacts?.length ? <ul>{prompt.impacts.map((impact, i) => <li key={i}>Scheduled start changes from {impact.before_start ?? 'unscheduled'} to {impact.after_start ?? 'unscheduled'}.</li>)}</ul> : null}
          {prompt?.requires_finish_early ? <>
            <p>This finishes {prompt.freed_days} working days early.</p>
            <Button disabled={busy} onClick={() => void save({ finishEarlyAction: 'pull_forward' })}>Pull following jobs forward</Button>
            <Button disabled={busy} onClick={() => void save({ finishEarlyAction: 'keep_schedule' })}>Keep following schedule</Button>
          </> : prompt?.requires_confirmation ? <Button disabled={busy} onClick={() => void save({ force: true })}>Confirm schedule changes</Button>
            : status.scheduled || !status.completed ? <Button disabled={busy || status.archived || (!status.scheduled && (!date || !note.trim()))}
              onClick={() => void save()}>{status.completed ? 'Reopen delivery' : 'Confirm delivery completed'}</Button> : null}
        </> : null}
      </PipelineModal>
    </span>
  );
}
