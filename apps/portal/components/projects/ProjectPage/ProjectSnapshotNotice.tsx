import { AlertBanner, Button } from '@/components/ui/foundation';
import type { ProjectSnapshotLoadState } from '@/lib/projects/types';
import ReadStatus from '@/components/page-state/ReadStatus';

export default function ProjectSnapshotNotice({ state, onRetry, hasSavedDetails = true }: {
  hasSavedDetails?: boolean;
  state: ProjectSnapshotLoadState;
  onRetry: () => void;
}) {
  if (state === 'summary') {
    return <ReadStatus title="Updating project" details={<AlertBanner tone="info" title="Updating project">
      Loading the latest Project Work, commercial state, notes and events.
    </AlertBanner>}/>;
  }
  if (state === 'refresh-failed') {
    const title = hasSavedDetails ? "Showing saved project details" : "Could not load project details";
    return <ReadStatus title={title} tone="warning" action={<Button variant="secondary" onClick={onRetry}>Retry</Button>} details={<AlertBanner tone="warning" title={title}
      action={<Button variant="secondary" onClick={onRetry}>Retry</Button>}>
      {hasSavedDetails ? "The latest refresh failed. Your last known details remain available." : "The project details could not be read. Record actions remain paused."}
    </AlertBanner>}/>;
  }
  return <ReadStatus title={state==='pending'?'Reading project…':state==='unavailable'?'Project unavailable':'Project current'} tone={state==='unavailable'?'error':'neutral'}/>;
}
