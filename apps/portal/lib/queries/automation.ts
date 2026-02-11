import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { getDesignTicket, listAuditEvents, listEmailOutbox, listFollowupTasks, listProjectTasks } from '@/lib/repo/automationRepo';

export const projectTasksQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.automation.tasks(host, projectId),
    queryFn: () => listProjectTasks(projectId),
  });

export const designTicketQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.automation.designTicket(host, projectId),
    queryFn: () => getDesignTicket(projectId),
  });

export const followupTasksQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.automation.followups(host, projectId),
    queryFn: () => listFollowupTasks(projectId),
  });

export const emailOutboxQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.automation.outbox(host, projectId),
    queryFn: () => listEmailOutbox(projectId),
  });

export const auditEventsQueryOptions = (host: string, projectId: string, limit: number) =>
  queryOptions({
    queryKey: qk.automation.audit(host, projectId, limit),
    queryFn: () => listAuditEvents(projectId, limit),
  });
