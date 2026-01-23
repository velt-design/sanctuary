'use client';

import type { Contact } from '@/lib/types/contact';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import type { ImportResult } from '@/lib/export/json';
import { nowIso } from '@/lib/utils/time';
import { newId } from '@/lib/utils/id';
import { upsertContact } from '@/lib/repo/contactsRepo';
import { getProject, upsertProject } from '@/lib/repo/projectsRepo';
import { upsertEstimate } from '@/lib/repo/estimatesRepo';

export async function persistImportResultToDb(result: ImportResult): Promise<void> {
  if (result.kind === 'project') {
    for (const c of result.contacts) await upsertContact(c);
    await upsertProject({ ...result.project, projectName: result.project.projectName ?? result.project.name ?? 'Imported project' });
    for (const e of result.estimates) {
      await upsertEstimate(e);
    }
    return;
  }

  if (result.kind === 'estimate') {
    for (const c of result.contacts) await upsertContact(c);

    const estimate: Estimate = result.estimate;

    const project = await getProject(estimate.projectId).catch(() => null);

    if (!project) {
      const snap = (estimate as any).snapshot as any;
      const contactSnap = snap?.contact ?? {};
      const now = nowIso();

      const contact: Contact = {
        id: newId('ct'),
        createdAt: now,
        updatedAt: now,
        displayName:
          typeof contactSnap.displayName === 'string'
            ? contactSnap.displayName
            : typeof contactSnap.name === 'string'
              ? contactSnap.name
              : 'Imported contact',
        email: typeof contactSnap.email === 'string' ? contactSnap.email : '',
        phone: typeof contactSnap.phone === 'string' ? contactSnap.phone : '',
      };
      await upsertContact(contact);

      const stub: Project = {
        id: estimate.projectId,
        createdAt: now,
        updatedAt: now,
        status: 'NEW',
        contactId: contact.id,
        projectName: typeof snap?.project?.projectName === 'string' ? snap.project.projectName : 'Imported project',
        region: typeof snap?.project?.region === 'string' ? snap.project.region : undefined,
        siteAddress: typeof snap?.project?.siteAddress === 'string' ? snap.project.siteAddress : undefined,
        quoteRef: typeof (estimate as any).inputs?.quoteRef === 'string' ? (estimate as any).inputs.quoteRef : undefined,
        name: 'Imported project',
      };
      await upsertProject(stub);
    }

    await upsertEstimate(estimate);
    return;
  }

  const _exhaustive: never = result;
  void _exhaustive;
}
