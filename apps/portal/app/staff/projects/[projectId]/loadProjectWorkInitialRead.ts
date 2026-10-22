import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { getProjectPageSnapshot, getProjectPageSummary } from '@/lib/projects/getProjectPageSnapshot';
import { createProjectCommandCentreRead } from '@/lib/projects/commandCentre/getProjectCommandCentre';
import { getProjectInvoiceSchedule } from '@/lib/invoices/adminPayments';
import type { ProjectWorkInitialRead, ProjectWorkReadResult } from '@/lib/projects/projectWorkInitialRead';

async function result<T>(read: Promise<T | null>, message: string): Promise<ProjectWorkReadResult<T>> {
  try {
    const data = await read;
    return data === null ? { ok: false, status: 404, message: 'Project not found' } : { ok: true, data };
  } catch {
    return { ok: false, status: 500, message };
  }
}

/** Called only after the page's fresh staff gate. Every promise belongs to this invocation. */
export function loadProjectWorkInitialRead(projectId: string, viewer: { userId: string; isAdmin: boolean }): ProjectWorkInitialRead {
  const clientRead = getSupabaseServerAuth();
  const commandRead = clientRead.then((client) => createProjectCommandCentreRead(projectId, client, viewer));
  const summary = clientRead.then(async (client) => {
    const snapshot = await getProjectPageSummary(projectId, undefined, client);
    return snapshot && { snapshot, generatedAt: new Date().toISOString() };
  });
  const snapshot = Promise.all([clientRead, commandRead]).then(async ([client, command]) => {
    const snapshot = await getProjectPageSnapshot(projectId, undefined, client, viewer.userId, command);
    return snapshot && { snapshot, generatedAt: new Date().toISOString() };
  });
  // This is the existing service-backed financial reader, with the same current-role filter as its API.
  const payment = getProjectInvoiceSchedule(projectId, { includePaymentEntries: viewer.isAdmin });
  let host = 'unknown';
  try { host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '').host; } catch { /* API recovery retains its existing configuration error. */ }
  return {
    id: randomUUID(), ownerId: viewer.userId, host, projectId,
    results: {
      summary: result(summary, 'Failed to load project summary'),
      snapshot: result(snapshot, 'Failed to load project snapshot'),
      command: result(commandRead.then((read) => read.read()), 'Failed to load project command centre'),
      payment: result(payment, 'Failed to load invoice schedule'),
    },
  };
}
