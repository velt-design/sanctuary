import type { Contact } from '@/lib/types/contact';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { listContacts } from '@/lib/repo/contactsRepo';

type ExportEnvelopeVersion = 'sp_export_v1';

type EstimateExportFileV1 = {
  version: ExportEnvelopeVersion;
  kind: 'estimate';
  exportedAt: string;
  estimate: Estimate;
  contacts?: Contact[];
};

export function downloadJson(filename: string, data: unknown) {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function makeEstimateExportFile(estimate: Estimate): Promise<EstimateExportFileV1> {
  const contactsAll = await listContacts().catch(() => []);
  const email = estimate?.snapshot?.contact?.email;
  const contacts = typeof email === 'string' && email.trim() ? contactsAll.filter((c) => c.email === email) : [];
  return {
    version: 'sp_export_v1',
    kind: 'estimate',
    exportedAt: nowIso(),
    estimate,
    contacts,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const v = value as any;
  const hasName = typeof v.projectName === 'string' || typeof v.name === 'string';
  return typeof v.id === 'string' && typeof v.createdAt === 'string' && hasName;
}

function isEstimate(value: unknown): value is Estimate {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.projectId === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.status === 'string' &&
    isRecord(value.inputs) &&
    isRecord(value.outputs) &&
    isRecord(value.configVersions)
  );
}

export type ImportResult =
  | { kind: 'project'; projectId: string; estimatesImported: number; project: Project; estimates: Estimate[]; contacts: Contact[] }
  | { kind: 'estimate'; estimateId: string; projectId: string; projectCreated: boolean; estimate: Estimate; contacts: Contact[] };

function coerceProjectName(project: any): string {
  const candidate = typeof project.projectName === 'string' ? project.projectName : typeof project.name === 'string' ? project.name : '';
  return candidate.trim() || 'Imported project';
}

function coerceSiteAddress(project: any): string {
  const candidate = typeof project.siteAddress === 'string' ? project.siteAddress : typeof project.address === 'string' ? project.address : '';
  return candidate.trim();
}

function coerceContactFromProject(project: any): Pick<Contact, 'displayName' | 'email' | 'phone'> {
  const displayName =
    (typeof project.clientName === 'string' ? project.clientName : '') ||
    (typeof project.name === 'string' ? project.name : '') ||
    (typeof project.projectName === 'string' ? project.projectName : '') ||
    'Imported contact';
  return {
    displayName: String(displayName).trim() || 'Imported contact',
    email: typeof project.email === 'string' ? project.email.trim() : '',
    phone: typeof project.phone === 'string' ? project.phone.trim() : '',
  };
}

function ensureProjectHasContact(project: Project, contactsIn: Contact[]): { project: Project; contacts: Contact[] } {
  const contacts = contactsIn.slice();
  if (project.contactId && contacts.some((c) => c.id === project.contactId)) return { project, contacts };

  const contactData = coerceContactFromProject(project as any);
  const now = nowIso();
  const contact: Contact = {
    id: newId('ct'),
    createdAt: now,
    updatedAt: now,
    ...contactData,
  };
  contacts.push(contact);

  const updatedProject: Project = {
    ...project,
    contactId: contact.id,
    projectName: project.projectName ?? project.name,
    siteAddress: project.siteAddress ?? project.address,
    status: project.status ?? 'NEW',
    updatedAt: project.updatedAt ?? project.createdAt,
  };
  return { project: updatedProject, contacts };
}

export function importExportFile(payload: unknown): ImportResult {
  if (!isRecord(payload) || payload.version !== 'sp_export_v1' || typeof payload.kind !== 'string') {
    throw new Error('Invalid export file (unsupported version).');
  }

  if (payload.kind === 'project') {
    const project = (payload as any).project;
    const estimates = (payload as any).estimates;
    const contactsFromFile = Array.isArray((payload as any).contacts) ? ((payload as any).contacts as unknown[]) : [];
    if (!isProject(project)) throw new Error('Invalid project export: missing project.');
    if (!Array.isArray(estimates) || !estimates.every(isEstimate)) throw new Error('Invalid project export: missing estimates.');

    const contactsValid = contactsFromFile.filter((c) => isRecord(c) && typeof (c as any).id === 'string') as Contact[];
    const { project: projectNext, contacts: contactsNext } = ensureProjectHasContact(
      {
        ...project,
        projectName: (project as any).projectName ?? (project as any).name,
        siteAddress: (project as any).siteAddress ?? (project as any).address,
        status: (project as any).status ?? 'NEW',
        updatedAt: (project as any).updatedAt ?? (project as any).createdAt,
      },
      contactsValid,
    );

    const contactsDeduped = Array.from(new Map(contactsNext.map((c) => [c.id, c])).values());

    for (const e of estimates) {
      if (e.projectId !== projectNext.id) throw new Error(`Estimate ${e.id} does not belong to project ${projectNext.id}.`);
    }

    return { kind: 'project', projectId: projectNext.id, estimatesImported: estimates.length, project: projectNext, estimates, contacts: contactsDeduped };
  }

  if (payload.kind === 'estimate') {
    const estimate = (payload as any).estimate;
    const contactsFromFile = Array.isArray((payload as any).contacts) ? ((payload as any).contacts as unknown[]) : [];
    if (!isEstimate(estimate)) throw new Error('Invalid estimate export: missing estimate.');

    const contactsValid = contactsFromFile.filter((c) => isRecord(c) && typeof (c as any).id === 'string') as Contact[];
    return { kind: 'estimate', estimateId: estimate.id, projectId: estimate.projectId, projectCreated: false, estimate, contacts: contactsValid };
  }

  throw new Error('Invalid export file kind.');
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('File is not valid JSON.');
  }
}
