// @vitest-environment node
import { it, expect } from 'vitest';
import { pathToFileURL } from 'node:url';
import { studioClientDocumentFixture } from './fixtures/studio-client-documents';
import { projectStudioClientDocument } from '../apps/portal/lib/designStudio/clientDocumentProjection.server';
import { renderStudioDocumentPage } from '../packages/studio-documents/src/render';
import { approvedDrawingSource } from './fixtures/studio-approved-drawings';

/** Delivery conformance against an explicitly supplied read-only predecessor,
 * separate from the portable ordinary suite. No customer fixture is required. */
it.runIf(!!process.env.STUDIO_LEGACY_RENDERER_MODULE)(
  'keeps both legacy and v2 frozen pages byte-exact against the held predecessor',
  async () => {
    const baseline = await import(
      /* @vite-ignore */ pathToFileURL(
        process.env.STUDIO_LEGACY_RENDERER_MODULE!,
      ).href
    );
    const original = projectStudioClientDocument(
      studioClientDocumentFixture(),
      {
        snapshotId: '10000000-0000-4000-8000-000000000002',
        contentHash: 'a'.repeat(64),
        designVersionLabel: 'V2',
        projectName: 'Synthetic legacy conformance',
        siteAddress: '',
        issuedAt: '2026-10-29T00:00:00Z',
        issuedDate: '29 OCT 2026',
      },
    );
    for (const version of [undefined, 'studio-booklet-layout.v2'] as const) {
      const source = {
        ...original,
        ...(version ? { layoutVersion: version } : {}),
      };
      for (const page of [0, 1, 2])
        expect(await renderStudioDocumentPage(source, page)).toEqual(
          await baseline.renderStudioDocumentPage(source, page),
        );
    }
  },
  60000,
);
it.runIf(!!process.env.STUDIO_LEGACY_RENDERER_MODULE)(
  'keeps frozen v3 cover and every drawing kind byte-exact against the held V8 predecessor',
  async()=>{
    const baseline=await import(/* @vite-ignore */ pathToFileURL(process.env.STUDIO_LEGACY_RENDERER_MODULE!).href);
    const source=approvedDrawingSource();
    const representatives=[...new Map(source.pageManifest!.map(sheet=>[sheet.kind,sheet])).values()];
    expect(representatives).toHaveLength(7);
    for(const sheet of representatives)expect(await renderStudioDocumentPage(source,sheet.index)).toEqual(await baseline.renderStudioDocumentPage(source,sheet.index));
  },60000,
);
