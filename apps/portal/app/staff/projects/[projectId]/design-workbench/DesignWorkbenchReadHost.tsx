"use client";
import { useCallback, useEffect, useLayoutEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import WorkbenchChrome, { type WorkbenchDraftSaveAction } from '@/components/drawings/workbench/WorkbenchChrome';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { EstimateDetail } from '@/lib/estimates/types';
import pageStyles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import styles from './DesignWorkbenchEstimateClient.module.css';
import { workbenchProjectMatches } from './workbenchPageRead';
import type { WorkbenchContextRead, WorkbenchEstimateRead, WorkbenchPageRead, WorkbenchRouteContext } from './workbenchPageRead';
import Runtime from './DesignWorkbenchEstimateClient';

type ReadyContext = Extract<WorkbenchRouteContext, { kind: 'ready' }>;
type Ready = { key: string; context: ReadyContext; estimate: EstimateDetail };
type Props = { projectId: string; estimateId: string | null; requestId: string | null; initialRead: WorkbenchPageRead; backHref: string; debugExportEnabled?: boolean; readOnly?: boolean; retryRead?: () => void };

export default function DesignWorkbenchReadHost({ projectId, estimateId, requestId, initialRead, backHref, debugExportEnabled = false, readOnly = false, retryRead }: Props) {
  const key = JSON.stringify([projectId, estimateId, requestId]);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [viewportMode, setViewportMode] = useState<DrawingWorkbenchViewportMode>('geometry3d');
  const [contextRead, setContextRead] = useState<{ read: WorkbenchPageRead; key: string; value: WorkbenchContextRead } | null>(null);
  const [estimateRead, setEstimateRead] = useState<{ read: WorkbenchPageRead; key: string; value: WorkbenchEstimateRead } | null>(null);
  const [lastReady, setLastReady] = useState<Ready | null>(null);
  const [save, setSave] = useState<{ key: string; read: WorkbenchPageRead; estimate: EstimateDetail | null; action: WorkbenchDraftSaveAction | null } | null>(null);
  const contextResult = contextRead?.read === initialRead && contextRead.key === key ? contextRead.value : null;
  const estimateResult = estimateRead?.read === initialRead && estimateRead.key === key ? estimateRead.value : null;
  const context = contextResult?.kind === 'context' ? contextResult.context : null;
  const detail = estimateResult?.kind === 'estimate' ? estimateResult.estimate : null;
  const matching = context?.kind === 'ready' && detail?.id === context.estimate.id && workbenchProjectMatches(detail.projectId, projectId) && workbenchProjectMatches(context.project.id, projectId);
  const failure = contextResult?.kind === 'error' ? contextResult : estimateResult?.kind === 'error' ? estimateResult : null;
  const absent = context?.kind === 'no_estimate' || context?.kind === 'project_unavailable' || (context?.kind === 'ready' && estimateResult?.kind === 'estimate' && !matching);
  const fatal = absent || Boolean(failure?.accessEnded);
  const phase = failure || context?.kind === 'project_unavailable' || (context?.kind === 'ready' && estimateResult?.kind === 'estimate' && !matching)
    ? 'error' : context?.kind === 'no_estimate' ? 'empty' : matching && !refreshing ? 'ready' : 'pending';
  const currentReady: Ready | null = matching ? { key, context, estimate: detail } : null;
  const retained = !fatal && lastReady?.key === key && (context?.kind !== 'ready' || context.estimate.id === lastReady.estimate.id) ? lastReady : null;
  const runtime = currentReady ?? retained;
  const locked = readOnly || phase !== 'ready';
  // Detail denial invalidates context presentation too, including a context that
  // completed earlier in this same read. Route identity itself remains static.
  const presentedContext = failure?.accessEnded ? null : context;
  const project = presentedContext && presentedContext.kind !== 'project_unavailable' ? presentedContext.project : failure?.accessEnded ? null : runtime?.context.project;
  const updateSave = useCallback((action: WorkbenchDraftSaveAction | null) => {
    setSave({ key, read: initialRead, estimate: runtime?.estimate ?? null, action });
  }, [key, initialRead, runtime?.estimate]);

  useLayoutEffect(() => { setLastReady(null); }, [key]);
  useLayoutEffect(() => {
    if (fatal) setLastReady(null);
    else if (matching) setLastReady((previous) => previous?.key === key && previous.estimate === detail ? previous : { key, context, estimate: detail });
  }, [fatal, matching, key, context, detail]);
  useEffect(() => {
    let retired = false;
    const failed = { kind: 'error' as const, message: 'The workbench read could not complete. Retry the read.', accessEnded: false };
    void Promise.resolve(initialRead.context).then((value) => { if (!retired) setContextRead({ key, read: initialRead, value }); }, () => { if (!retired) setContextRead({ key, read: initialRead, value: failed }); });
    void Promise.resolve(initialRead.estimate).then((value) => { if (!retired) setEstimateRead({ key, read: initialRead, value }); }, () => { if (!retired) setEstimateRead({ key, read: initialRead, value: failed }); });
    return () => { retired = true; };
  }, [initialRead, key]);

  const action = save?.key === key && save.read === initialRead && save.estimate === runtime?.estimate ? save.action : null;
  const message = phase === 'error' ? failure?.message ?? 'The selected project or estimate is unavailable. Retry the read.'
    : phase === 'empty' ? 'No usable estimate exists for this project yet. Create or generate an estimate before opening the workbench.'
    : phase === 'pending' ? context?.kind === 'ready' ? `Reading selected design ${context.estimate.versionLabel}…` : 'Reading project and design selection…' : null;
  return <main className={pageStyles.page} data-project-id={projectId} data-workbench-context={phase} data-estimate-id={runtime?.estimate.id ?? (presentedContext?.kind === 'no_estimate' ? presentedContext.providedEstimateId ?? undefined : undefined)} data-request-id={presentedContext?.kind === 'ready' ? presentedContext.request?.id : presentedContext?.kind === 'no_estimate' ? presentedContext.providedRequestId ?? undefined : undefined} data-workbench-read-state={phase}>
    <section className={pageStyles.surface}><div className={pageStyles.surfaceInner}>
      <section aria-label="Drawing workbench" className={`${styles.shell} ${styles.readShell}`} data-workbench-density="compact">
        <div className={styles.readChrome}>
          <WorkbenchChrome viewportMode={viewportMode} onViewportModeChange={setViewportMode} backHref={backHref}
            projectLabel={project?.name ?? (phase === 'error' ? 'Project unavailable' : 'Reading project…')}
            draftSaveAction={{ label: action?.label ?? 'Save workbench draft', statusText: phase !== 'ready' ? (phase === 'error' ? 'Read unavailable' : phase === 'empty' ? 'No selected design' : 'Reading design…') : action?.statusText ?? (readOnly ? 'Read-only' : null), disabled: locked || !action || action.disabled, onSave: () => { if (!locked) action?.onSave(); } }} />
        </div>
        {runtime ? <Runtime key={runtime.estimate.id} estimate={runtime.estimate} projectName={runtime.context.project.name} siteAddress={runtime.context.project.siteAddress} backHref={backHref} debugExportEnabled={debugExportEnabled} readOnly={locked} externalChrome={{ viewportMode, onSaveActionChange: updateSave }} /> : null}
        {message ? <div className={styles.readStatus} aria-live="polite"><p role={phase === 'pending' ? 'status' : undefined}>{message}</p>{context?.kind === 'no_estimate' && context.providedEstimateId ? <p>Supplied estimateId: {context.providedEstimateId}</p> : null}{context?.kind === 'no_estimate' && context.providedRequestId ? <p>Supplied requestId: {context.providedRequestId}</p> : null}{runtime ? <p>Previously verified design remains visible. Record actions are paused until the current read succeeds.</p> : null}{phase === 'error' ? <button type="button" disabled={refreshing} onClick={() => startRefresh(retryRead ?? (() => router.refresh()))}>Retry workbench</button> : null}</div> : null}
      </section>
    </div></section>
  </main>;
}
