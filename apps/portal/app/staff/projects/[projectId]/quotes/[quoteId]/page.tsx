import PortalDebugExportButton from '@/components/debug/PortalDebugExportButton';
import { buildPortalPageDebugExport, isPortalPageDebugExportEnabled } from '@/lib/debug/portalPageDebugExport';

export default async function QuoteEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; quoteId: string }>;
}) {
  const { projectId, quoteId } = await params;
  const debugExport = isPortalPageDebugExportEnabled()
    ? buildPortalPageDebugExport({
        pageId: 'quote-detail',
        route: `/staff/projects/${encodeURIComponent(projectId)}/quotes/${encodeURIComponent(quoteId)}`,
        selectedIds: {
          projectId,
          quoteId,
          quoteVersionId: quoteId,
        },
        serverState: {
          routeParams: { projectId, quoteId },
          routeStatus: 'placeholder',
        },
        clientState: {},
        diagnostics: {
          debugExportStatus: 'ready',
          source: 'quote-placeholder-page',
          quoteModuleStatus: 'not_active',
        },
        scenario: null,
      })
    : null;

  return (
    <main style={{ padding: 16 }}>
      {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}
      <h1 style={{ margin: 0 }}>Quote</h1>
      <p style={{ marginTop: 8, opacity: 0.75 }}>This module is not active yet.</p>
    </main>
  );
}
