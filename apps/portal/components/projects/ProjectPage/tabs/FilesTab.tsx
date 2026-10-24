'use client';

import { useEffect } from 'react';
import {ProjectFilesWorkspace,type FilesBinding} from './ProjectFilesSurface';
import ProjectEnquiryFilesPanel from './overview/ProjectEnquiryFilesPanel';
import ProjectSharePointFilesPanel from './overview/ProjectSharePointFilesPanel';

/** The project route owns the workspace; existing file owners retain reads and return state. */
export default function FilesTab({ projectId, host, surface }: { projectId: string; host: string; surface?:FilesBinding }) {
  useEffect(() => { void import('./QuotePdfInlinePreview').then(module => module.preloadQuotePdfPreview()).catch(() => undefined); }, []);
  const panel=<ProjectSharePointFilesPanel projectId={projectId} host={host} workspace surface={surface} websiteFiles={<ProjectEnquiryFilesPanel projectId={projectId} host={host}/>}/>;
  return surface ? panel : <ProjectFilesWorkspace projectId={projectId}>{panel}</ProjectFilesWorkspace>;
}
