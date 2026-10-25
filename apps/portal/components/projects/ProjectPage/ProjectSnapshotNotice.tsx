import { AlertBanner, Button } from '@/components/ui/foundation';
import type { ProjectSnapshotLoadState } from '@/lib/projects/types';

export default function ProjectSnapshotNotice({ state, onRetry, hasSavedDetails = true }: {
  hasSavedDetails?: boolean;
  state: ProjectSnapshotLoadState;
  onRetry: () => void;
}) {
  if (state === 'summary') {
    return <AlertBanner tone="info" title="Updating project">
      Loading the latest Project Work, commercial state, notes and events.
    </AlertBanner>;
  }
  if (state === 'refresh-failed') {
    return <AlertBanner tone="warning" title={hasSavedDetails ? "Showing saved project details" : "Could not load project details"}
      action={<Button variant="secondary" onClick={onRetry}>Retry</Button>}>
      {hasSavedDetails ? "The latest refresh failed. Your last known details remain available." : "The project details could not be read. Record actions remain paused."}
    </AlertBanner>;
  }
  return null;
}
