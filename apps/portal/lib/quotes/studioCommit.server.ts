import {quotePresentationVersion} from './quotePresentation';
import 'server-only';
import { supabaseServiceRole } from '@/lib/supabaseClient';
import type { StudioQuoteView } from '@/lib/designStudio/quoteSnapshot';

export async function commitQuoteWithStudioBinding(operation: 'create' | 'refresh' | 'revise', command: Record<string, unknown>) {
  const metadata = command.p_pricing_source_metadata as Record<string, unknown> | null;
  if (typeof metadata?.studioSnapshotId !== 'string') return supabaseServiceRole.rpc(operation === 'refresh' ? 'commercial_quote_update_draft' : 'commercial_quote_create_draft', command);
  if (typeof metadata.studioSnapshotHash !== 'string') throw Error('The frozen Studio design identity is incomplete.');
  return supabaseServiceRole.rpc(metadata.studioDocumentMode==='separate_v1'?'studio_client_quote_commit':'studio_website_quote_commit_address', { p_operation: operation, p_snapshot_id: metadata.studioSnapshotId,
    p_content_hash: metadata.studioSnapshotHash, p_command: command });
}

export async function loadStudioQuoteView(quoteVersionId: string, metadata: unknown): Promise<StudioQuoteView | undefined> {
  const reference = metadata as Record<string, unknown> | null;
  const result = await supabaseServiceRole.rpc('studio_website_quote_view', { p_quote_version_id: quoteVersionId });
  const view = result.data as StudioQuoteView | null;
  if (!result.error && !view && typeof reference?.studioSnapshotId !== 'string') return undefined;
  if (result.error || !view || !['studio_quote_snapshot.v1','studio_quote_snapshot.v2'].includes(view.schemaVersion) || (view.schemaVersion==='studio_quote_snapshot.v2'&&view.documentMode!=='separate_v1') || view.snapshotId !== reference?.studioSnapshotId || view.contentHash !== reference?.studioSnapshotHash)
    throw Error('The frozen Studio design is unavailable. The quote cannot be rendered without it.');
  quotePresentationVersion(view);
  return view;
}
