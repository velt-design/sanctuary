'use client';

import type { ReactNode } from 'react';
import { ContactsIndexWorkspace } from '@/app/staff/contacts/ContactsIndexWorkspace';
import { ScheduleWorkspace } from '@/app/staff/schedule/ScheduleWorkspace';
import {DashboardWorkspace} from '@/app/dashboard/DashboardWorkspace';
import {ProjectsIndexWorkspace} from '@/app/staff/projects/ProjectsIndexWorkspace';
import {WorkQueueWorkspace} from '@/app/staff/projects/work-queue/WorkQueueWorkspace';
import {SpreadsheetWorkspace} from '@/components/spreadsheet/SpreadsheetWorkspace';
import { usePortalPageSource } from './PortalPageSource';

export default function PortalActualFrames({ children,navigationPath }: { children: ReactNode;navigationPath?:string }) {
  const source = usePortalPageSource();
  const path = source?.frameSuppressed ? null : source?.selectedPath;
  const href = source?.href ?? path ?? '/';
  const selection = new URL(href, 'http://localhost');
  const scheduleView = selection.searchParams.get('view')?.trim().toLowerCase();
  const entryIdentity = source?.attempt?.identity ?? source?.canonicalPath ?? '/';
  const unavailable=Boolean(source?.attempt?.unavailable);
  return <DashboardWorkspace visible={path==='/dashboard'} owner={path==='/dashboard'?source?.owner??null:null}
    entryIdentity={entryIdentity} unavailable={unavailable} onRetry={source?.retry}>
    <ProjectsIndexWorkspace visible={path==='/staff/projects'} owner={path==='/staff/projects'?source?.owner??null:null}
      search={selection.search.slice(1)} navigationPath={navigationPath} entryIdentity={entryIdentity} unavailable={unavailable} onRetry={source?.retry}>
    <WorkQueueWorkspace visible={path==='/staff/projects/work-queue'} owner={path==='/staff/projects/work-queue'?source?.owner??null:null}
      entryIdentity={entryIdentity} unavailable={unavailable} onRetry={source?.retry}>
    <SpreadsheetWorkspace kind={path==='/staff/projects/design-packages'?'design':path==='/staff/projects/running-jobs'?'running':null}
      owner={path==='/staff/projects/design-packages'||path==='/staff/projects/running-jobs'?source?.owner??null:null}
      entryIdentity={entryIdentity} unavailable={unavailable} onRetry={source?.retry}>
    <ContactsIndexWorkspace visible={path === '/staff/contacts'}
    unavailable={Boolean(source?.attempt?.unavailable)} onRetry={source?.retry}
    entryIdentity={entryIdentity}
    owner={path === '/staff/contacts' ? source?.owner ?? null : null}
    initialQuery={selection.searchParams.get('q')?.trim() ?? ''}>
    <ScheduleWorkspace visible={path === '/staff/schedule' && scheduleView !== 'site-visits'}
      unavailable={Boolean(source?.attempt?.unavailable)} onRetry={source?.retry}
      entryIdentity={entryIdentity} initialView={scheduleView === 'gantt' ? 'gantt' : 'board'}
      owner={path === '/staff/schedule' ? source?.owner ?? null : null}>
      {children}
    </ScheduleWorkspace>
  </ContactsIndexWorkspace></SpreadsheetWorkspace></WorkQueueWorkspace></ProjectsIndexWorkspace></DashboardWorkspace>;
}
