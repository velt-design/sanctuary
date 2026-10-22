'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import ProjectEnquiryFilesPanel from './overview/ProjectEnquiryFilesPanel';
import ProjectSharePointFilesPanel from './overview/ProjectSharePointFilesPanel';
import styles from './FilesTab.module.css';

/** The project route owns the workspace; existing file owners retain reads and return state. */
export default function FilesTab({ projectId, host }: { projectId: string; host: string }) {
  useEffect(() => { void import('./QuotePdfInlinePreview').then(module => module.preloadQuotePdfPreview()).catch(() => undefined); }, []);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const frame = workspace.closest<HTMLElement>('[data-project-page-frame]');
    // The Overview may have been scrolled below the fold. Re-enter at its stable
    // masthead rather than leaving the shorter workspace beneath the old offset.
    const enterWorkspace = () => {
      if (frame && frame.getBoundingClientRect().top < 0) {
        window.scrollTo({ top: window.scrollY + frame.getBoundingClientRect().top, behavior: 'instant' });
      }
    };
    enterWorkspace();
    const measure = () => {
      const page = workspace.closest('main');
      const bottomSpace = page ? parseFloat(window.getComputedStyle(page).paddingBottom) || 0 : 12;
      // Use document position so a retained Overview offset cannot increase the
      // new workspace height and create a self-sustaining document scrollbar.
      const top = workspace.getBoundingClientRect().top + window.scrollY;
      workspace.style.setProperty('--project-files-height', `${Math.max(280, window.innerHeight - top - bottomSpace)}px`);
    };
    measure();
    // Reconcile after the old Overview's scroll anchor and the new available
    // height have settled, including a cached lazy module or history return.
    const entryFrame = requestAnimationFrame(() => { enterWorkspace(); measure(); });
    const observer = new ResizeObserver(measure);
    if (frame) observer.observe(frame.querySelector('[data-project-masthead-slot]') ?? frame);
    // Snapshot notices share the tab body and can appear without changing the masthead.
    if (workspace.parentElement) observer.observe(workspace.parentElement);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(entryFrame); observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [projectId]);
  return (
    <div ref={workspaceRef} className={styles.workspace} data-project-files-workspace="true">
      <ProjectSharePointFilesPanel
        projectId={projectId}
        host={host}
        workspace
        websiteFiles={<ProjectEnquiryFilesPanel projectId={projectId} host={host} />}
      />
    </div>
  );
}
