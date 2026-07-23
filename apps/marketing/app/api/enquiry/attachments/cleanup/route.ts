import 'server-only';

import { NextResponse } from 'next/server';
import { secureTokenMatches } from '@/lib/marketingPublicRequest';
import { getServiceSupabase } from '@/lib/supabaseService';

const BUCKET = 'enquiry-attachments';
const BATCH_SIZE = 100;

type StaleSession = {
  submission_id?: unknown;
  expected_files?: unknown;
};

function expectedPaths(value: unknown, submissionId: string): string[] {
  const prefix = `pending/${submissionId}/`;
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const path = typeof (entry as { path?: unknown })?.path === 'string'
        ? String((entry as { path: string }).path)
        : '';
      return path.startsWith(prefix) ? path : '';
    })
    .filter(Boolean);
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim() || '';
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!cronSecret || !provided || !secureTokenMatches(provided, cronSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: false, error: 'Cleanup unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase.rpc('marketing_enquiry_stale_upload_sessions', {
    p_limit: BATCH_SIZE,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Cleanup unavailable' }, { status: 503 });
  }

  const cleanedSubmissionIds: string[] = [];
  let removedObjects = 0;

  for (const session of (Array.isArray(data) ? data : []) as StaleSession[]) {
    const submissionId = typeof session.submission_id === 'string' ? session.submission_id : '';
    if (!submissionId) continue;
    const paths = expectedPaths(session.expected_files, submissionId);
    if (paths.length) {
      const removeResult = await supabase.storage.from(BUCKET).remove(paths);
      if (removeResult.error) continue;
      removedObjects += paths.length;
    }
    cleanedSubmissionIds.push(submissionId);
  }

  let deletedSessions = 0;
  if (cleanedSubmissionIds.length) {
    const deleteResult = await supabase.rpc('marketing_enquiry_delete_stale_upload_sessions', {
      p_submission_ids: cleanedSubmissionIds,
    });
    if (deleteResult.error) {
      return NextResponse.json({ ok: false, error: 'Cleanup unavailable' }, { status: 503 });
    }
    deletedSessions = Number(deleteResult.data) || 0;
  }

  return NextResponse.json({
    ok: true,
    scannedSessions: Array.isArray(data) ? data.length : 0,
    deletedSessions,
    removedObjects,
  });
}
