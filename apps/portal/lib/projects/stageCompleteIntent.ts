import { normalizePipelineStageKey, type PipelineStageKey } from '@/lib/projects/pipelineDefinition';

const completionKey = (projectId: string) => `stageCompleteIntent:${projectId}`;

export function setStageCompleteIntent(projectId: string, stage: PipelineStageKey) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(completionKey(projectId), JSON.stringify({ stage, ts: Date.now() }));
  } catch {
    // ignore storage errors (private mode / blocked storage)
  }
}

export function consumeStageCompleteIntent(projectId: string): { stage: PipelineStageKey; ts: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(completionKey(projectId));
    if (!raw) return null;
    window.sessionStorage.removeItem(completionKey(projectId));
    const parsed = JSON.parse(raw) as { stage?: unknown; ts?: unknown } | null;
    const stage = normalizePipelineStageKey(typeof parsed?.stage === 'string' ? parsed.stage : '');
    if (!stage) return null;
    const ts = typeof parsed?.ts === 'number' ? parsed.ts : Date.now();
    return { stage, ts };
  } catch {
    return null;
  }
}
