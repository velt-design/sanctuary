"use client";
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReadHost from '@/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchReadHost';
import type { WorkbenchPageRead } from '@/app/staff/projects/[projectId]/design-workbench/workbenchPageRead';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { bindLocalFirstStoreOwner, clearLocalFirstStoreOwner, ensureLocalFirstStoreReady, getLocalFirstStoreOwner, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import { buildEstimateDrawingDraftEntityKey } from '@/lib/localFirst/portalEntities';

const FIXTURE_OWNER = 'qa-progressive-workbench-fictional';
type Props = { projectId: string; estimateId: string; initialRead: WorkbenchPageRead; draft: EstimateDrawingDraft };

/** Gated fictional browser storage only. No business command or provider is served. */
export default function ProgressiveWorkbenchFixture({ projectId, estimateId, initialRead, draft }: Props) {
  const router = useRouter();
  const initialDraft = useRef(draft);
  const [preparation] = useState(() => {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
    return { promise, resolve, reject };
  });
  const read = useMemo<WorkbenchPageRead>(() => ({ context: initialRead.context, estimate: Promise.all([Promise.resolve(initialRead.estimate), preparation.promise]).then(([value]) => value) }), [initialRead, preparation]);
  useLayoutEffect(() => {
    let retired = false;
    const previousOwner = getLocalFirstStoreOwner();
    bindLocalFirstStoreOwner(FIXTURE_OWNER);
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Fictional read-only workbench. All API commands and unrelated reads are unavailable.' }, { status: 403 });
      return original(input, init);
    };
    void ensureLocalFirstStoreReady().then(async () => {
      // Only the existing baked object-first draft is persisted, under two fictional keys.
      for (const source of ['a', 'b']) {
        if (retired) return;
        await writeLocalFirstWorkingCopy({ entityKey: buildEstimateDrawingDraftEntityKey(`est_workbench_progressive_${source}`), data: initialDraft.current });
      }
      if (!retired) preparation.resolve();
    }, preparation.reject).catch(preparation.reject);
    return () => {
      retired = true;
      window.fetch = original;
      if (previousOwner) bindLocalFirstStoreOwner(previousOwner); else clearLocalFirstStoreOwner();
    };
  }, [preparation]);
  function select(source: string, scenario: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('source', source); url.searchParams.set('scenario', scenario);
    router.replace(url.pathname + url.search);
  }
  return <div>
    <nav aria-label="Fictional workbench read scenarios">
      <button type="button" onClick={() => select('a', 'complete')}>Read A</button>{' '}
      <button type="button" onClick={() => select('b', 'complete')}>Read B</button>{' '}
      <button type="button" onClick={() => select(projectId.endsWith('_b') ? 'b' : 'a', 'failure')}>Fail read</button>{' '}
      <button type="button" onClick={() => select(projectId.endsWith('_b') ? 'b' : 'a', 'denied')}>Deny read</button>{' '}
      <button type="button" onClick={() => router.refresh()}>Refresh verified source</button>
    </nav>
    <ReadHost projectId={projectId} estimateId={estimateId} requestId={null} initialRead={read} backHref="/qa/design-workbench-fixture?fixture=multi-house-u-two-pergola" readOnly retryRead={() => select(projectId.endsWith('_b') ? 'b' : 'a', 'complete')} />
  </div>;
}
