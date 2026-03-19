import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { EstimateDetail } from '../estimates/types';
import type { ProjectPageSnapshotResponse, ProjectTaskItem } from '../projects/types';
import { DEFAULT_QUOTE_TERMS } from '../quotes/defaults';
import type { QuoteVersionDetail } from '../quotes/types';
import type { Contact } from '../types/contact';
import type { Project } from '../types/project';
import { qk } from '../queries/keys';
import {
  applyDraftPatchToQuoteDetail,
  buildNextEstimateVersionLabel,
  patchProjectDetailsCaches,
  patchProjectTasksSnapshot,
  replaceEstimateDetailCache,
  replaceQuoteDetailCache,
  upsertContactCaches,
  upsertEstimateDetailCache,
  upsertQuoteDetailCache,
} from './portalEntities';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function makeEstimateDetail(overrides?: Partial<EstimateDetail>): EstimateDetail {
  return {
    id: 'est_local_1',
    projectId: 'proj_1',
    createdAt: '2026-03-19T12:00:00.000Z',
    status: 'draft',
    summary: { total: 1234 },
    createdBy: 'tester@example.com',
    versionLabel: 'V1',
    calculatorSnapshot: { inputs: {}, outputs: {} },
    internalNotes: null,
    editability: {
      isLocked: false,
      lockReason: null,
      lockedAt: null,
      lockedByQuoteVersionId: null,
      lockedByQuoteRef: null,
      lockedByQuoteVersionNumber: null,
      hasDraftQuotes: false,
      draftQuoteCount: 0,
    },
    ...overrides,
  };
}

function makeQuoteDetail(overrides?: Partial<QuoteVersionDetail>): QuoteVersionDetail {
  return {
    id: 'qv_local_1',
    quoteId: 'q_local_1',
    projectId: 'proj_1',
    quoteRef: 'Q-1001',
    versionNumber: 1,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: 'est_1',
    sourceEstimateVersionLabel: 'V1',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-03-19T12:00:00.000Z',
    createdBy: 'tester@example.com',
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: null,
    customerName: 'Taylor',
    introText: 'Intro',
    termsText: DEFAULT_QUOTE_TERMS,
    totals: {
      totalIncGstCents: 1150,
      totalExGstCents: 1000,
      gstCents: 150,
    },
    pdfFileId: null,
    renderHash: null,
    lineItems: [
      {
        id: 'line_1',
        description: 'Pergola',
        qty: 1,
        unitPriceIncGstCents: 1150,
        lineTotalIncGstCents: 1150,
        sortOrder: 0,
      },
    ],
    sendLogs: [],
    contact: {
      name: 'Taylor',
      email: 'taylor@example.com',
      phone: null,
    },
    project: {
      name: 'Project One',
      siteAddress: null,
      region: null,
      quoteRef: 'Q-1001',
    },
    ...overrides,
  };
}

function makeProject(projectId = 'proj_1', contactId = 'ct_1'): Project {
  return {
    id: projectId,
    createdAt: '2026-03-19T12:00:00.000Z',
    updatedAt: '2026-03-19T12:00:00.000Z',
    projectName: 'Project One',
    name: 'Project One',
    contactId,
    clientName: 'Taylor',
    email: 'taylor@example.com',
    phone: '0210000000',
    region: 'North',
    quoteRef: 'Q-1001',
    siteAddress: '1 Example St',
    address: '1 Example St',
    nextActionDate: '2026-03-20',
    followUpDate: '2026-03-20',
    status: 'NEW',
  };
}

function makeProjectSnapshot(projectId = 'proj_1', contactId = 'ct_1'): ProjectPageSnapshotResponse {
  return {
    generatedAt: '2026-03-19T12:00:00.000Z',
    snapshot: {
      project: {
        id: projectId,
        name: 'Project One',
        stage: 'new',
        contactId,
        contactName: 'Taylor',
        contactEmail: 'taylor@example.com',
        contactPhone: '0210000000',
        siteAddress: '1 Example St',
        region: 'North',
        quoteRef: 'Q-1001',
        nextActionDate: '2026-03-20',
      },
      pipeline: {
        stage: 'new',
      },
      tasks: {
        stage: 'new',
        items: [
          {
            key: 'reminder',
            label: 'Reminder',
            kind: 'manual',
            isDone: false,
            isManualDone: false,
          },
        ],
      },
      activity: [],
      emails: [],
    },
  };
}

describe('portalEntities', () => {
  it('builds the next estimate version label from existing versions', () => {
    expect(
      buildNextEstimateVersionLabel([
        {
          id: 'est_1',
          projectId: 'proj_1',
          createdAt: '2026-03-18T10:00:00.000Z',
          status: 'draft',
          summary: {},
          versionLabel: 'V1',
        },
        {
          id: 'est_7',
          projectId: 'proj_1',
          createdAt: '2026-03-19T10:00:00.000Z',
          status: 'draft',
          summary: {},
          versionLabel: 'V7',
        },
      ]),
    ).toBe('V8');
  });

  it('applies draft patches and recomputes totals and deposit terms', () => {
    const updated = applyDraftPatchToQuoteDetail(makeQuoteDetail(), {
      depositPercent: 25,
      lineItems: [
        {
          description: 'Pergola',
          qty: 2,
          unitPriceIncGstCents: 2300,
        },
      ],
    });

    expect(updated.depositPercent).toBe(25);
    expect(updated.termsText).toContain('A 25% deposit is required to confirm your booking.');
    expect(updated.totals).toEqual({
      totalIncGstCents: 4600,
      totalExGstCents: 4000,
      gstCents: 600,
    });
    expect(updated.lineItems[0]).toMatchObject({
      id: 'line_1',
      qty: 2,
      unitPriceIncGstCents: 2300,
      lineTotalIncGstCents: 4600,
    });
  });

  it('replaces provisional estimate and quote cache entries with server-backed ids', () => {
    const queryClient = createQueryClient();
    const hostKey = 'host';
    const projectId = 'proj_1';

    const localEstimate = makeEstimateDetail({ id: 'local-estimate:1' });
    const syncedEstimate = makeEstimateDetail({ id: 'est_1', versionLabel: 'V2' });
    upsertEstimateDetailCache(queryClient, hostKey, projectId, localEstimate, { prepend: true });
    replaceEstimateDetailCache(queryClient, hostKey, projectId, localEstimate.id, syncedEstimate);

    expect(queryClient.getQueryData(qk.estimates.detail(hostKey, localEstimate.id))).toBeUndefined();
    expect(queryClient.getQueryData(qk.estimates.detail(hostKey, syncedEstimate.id))).toEqual(syncedEstimate);
    expect(queryClient.getQueryData(qk.estimates.metaByProject(hostKey, projectId))).toEqual([
      expect.objectContaining({ id: syncedEstimate.id, versionLabel: syncedEstimate.versionLabel }),
    ]);

    const localQuote = makeQuoteDetail({ id: 'local-quote:1', quoteId: 'local-quote:1' });
    const syncedQuote = makeQuoteDetail({ id: 'qv_1', quoteId: 'q_1', pdfFileId: 'file_1' });
    upsertQuoteDetailCache(queryClient, hostKey, projectId, localQuote, { prepend: true });
    replaceQuoteDetailCache(queryClient, hostKey, projectId, localQuote.id, syncedQuote);

    expect(queryClient.getQueryData(qk.quotes.detail(hostKey, localQuote.id))).toBeUndefined();
    expect(queryClient.getQueryData(qk.quotes.detail(hostKey, syncedQuote.id))).toEqual(syncedQuote);
    expect(queryClient.getQueryData(qk.quotes.versionsByProject(hostKey, projectId))).toEqual([
      expect.objectContaining({ id: syncedQuote.id, quoteId: syncedQuote.quoteId, pdfFileId: syncedQuote.pdfFileId }),
    ]);
  });

  it('patches project detail, contact, and task caches for autosave surfaces', () => {
    const queryClient = createQueryClient();
    const hostKey = 'host';
    const projectId = 'proj_1';
    const contactId = 'ct_1';

    queryClient.setQueryData(qk.projects.snapshot(hostKey, projectId), makeProjectSnapshot(projectId, contactId));
    queryClient.setQueryData(qk.projects.detail(hostKey, projectId), makeProject(projectId, contactId));
    queryClient.setQueryData(qk.projects.list(hostKey), [makeProject(projectId, contactId)]);
    queryClient.setQueryData(qk.projects.byContact(hostKey, contactId), [makeProject(projectId, contactId)]);
    queryClient.setQueryData<Contact[]>(qk.contacts.list(hostKey), [
      {
        id: contactId,
        displayName: 'Taylor',
        email: 'taylor@example.com',
        phone: '0210000000',
        createdAt: '2026-03-19T12:00:00.000Z',
        updatedAt: '2026-03-19T12:00:00.000Z',
      },
    ]);

    patchProjectDetailsCaches(queryClient, hostKey, projectId, {
      contactName: 'Jordan',
      contactEmail: 'jordan@example.com',
      contactPhone: '0400000000',
      projectName: 'Updated Project',
      siteAddress: '2 New St',
      region: 'South',
      quoteRef: 'Q-2002',
      nextActionDate: '2026-03-25',
    }, { contactId });

    const snapshot = queryClient.getQueryData<ProjectPageSnapshotResponse>(qk.projects.snapshot(hostKey, projectId));
    expect(snapshot?.snapshot.project).toMatchObject({
      name: 'Updated Project',
      contactName: 'Jordan',
      contactEmail: 'jordan@example.com',
      contactPhone: '0400000000',
      siteAddress: '2 New St',
      region: 'South',
      quoteRef: 'Q-2002',
      nextActionDate: '2026-03-25',
    });
    expect(queryClient.getQueryData<Project>(qk.projects.detail(hostKey, projectId))).toEqual(
      expect.objectContaining({
        projectName: 'Updated Project',
        clientName: 'Jordan',
        email: 'jordan@example.com',
      }),
    );

    upsertContactCaches(queryClient, hostKey, {
      id: contactId,
      displayName: 'Jordan',
      email: 'jordan@example.com',
      phone: '0400000000',
      createdAt: '2026-03-19T12:00:00.000Z',
      updatedAt: '2026-03-19T12:05:00.000Z',
    });
    expect(queryClient.getQueryData(qk.contacts.detail(hostKey, contactId))).toEqual(
      expect.objectContaining({ displayName: 'Jordan', email: 'jordan@example.com' }),
    );

    const nextTasks: ProjectTaskItem[] = [
      {
        key: 'reminder',
        label: 'Reminder',
        kind: 'manual',
        isDone: true,
        isManualDone: true,
      },
    ];
    patchProjectTasksSnapshot(queryClient, hostKey, projectId, nextTasks);
    expect(queryClient.getQueryData<ProjectPageSnapshotResponse>(qk.projects.snapshot(hostKey, projectId))?.snapshot.tasks.items).toEqual(nextTasks);
  });
});
