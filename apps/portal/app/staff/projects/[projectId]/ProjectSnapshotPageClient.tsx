"use client";

import ProjectInstantNavigationProvider, { useOptionalProjectWorkspace } from '../ProjectInstantNavigation';
import ProjectSnapshotRead from './ProjectSnapshotRead';
import type { ProjectSnapshotProps } from './ProjectSnapshotSurface';

/** Canonical leaves own reads; the retained layout owns the one actual frame. */
export default function ProjectSnapshotPageClient(props: ProjectSnapshotProps) {
  const workspace = useOptionalProjectWorkspace();
  if (!workspace) return <ProjectInstantNavigationProvider standaloneProject={props}>
    <ProjectSnapshotPageClient {...props} />
  </ProjectInstantNavigationProvider>;
  if (workspace.projectId !== props.projectId || !workspace.owner) return null;
  return <ProjectSnapshotRead {...props} estimatesList={workspace.estimatesList} quotesList={workspace.quotesList} invoicesList={workspace.invoicesList} publishCommercial={workspace.publishCommercial} overview={workspace.overview} files={workspace.files} publishJobPacks={workspace.publishJobPacks} navigation={workspace.navigation} publish={workspace.publish} warmCorrespondence={workspace.warmCorrespondence} />;
}
