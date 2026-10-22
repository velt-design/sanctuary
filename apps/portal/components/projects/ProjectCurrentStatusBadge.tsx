import { Badge, ProjectStageBadge } from '@/components/ui/foundation';
import { projectCurrentStatus, type ProjectStatusFacts } from '@/lib/projects/projectCurrentStatus';
import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';

export default function ProjectCurrentStatusBadge({
  stage, facts, pending = false, saved = false,
}: {
  stage?: PipelineStageKey;
  facts?: ProjectStatusFacts | null;
  pending?: boolean;
  saved?: boolean;
}) {
  const status = stage ? projectCurrentStatus(stage, facts, pending) : { state: null, stage: null, label: pending ? 'Reading status' : 'Status unavailable' };
  return (
    <span
      data-project-current-status={status.state ?? (status.stage ? 'legacy' : 'unknown')}
      title={saved ? 'Last known project status. The latest refresh failed.' : undefined}
    >
      {status.stage ? <ProjectStageBadge stage={status.stage} compact /> : (
        <Badge tone={status.state === 'WAITING' ? 'warning' : 'neutral'}>{status.label}</Badge>
      )}
    </span>
  );
}
