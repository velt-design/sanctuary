import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildQuoteHandoffPreviewFromEstimate } from '@/lib/quotes/estimateHandoffPreview';
import { getProjectWorkProjection } from '@/lib/projects/workItems/repository';
import { getProjectWorkDomainActions } from '@/lib/projects/workItems/getProjectWorkDomainActions';
import { isProjectWorkModelV2 } from '@/lib/projects/workItems/modelBoundary';
import { appIdFromUuid, isRecord, uuidFromAppId } from '@/lib/supabase/mappers';
import type { Estimate } from '@/lib/types/estimate';
import { resolveCommandCentreSelection } from './resolve';
import { buildProjectOwnerSummary } from './projectOwners';
import { resolveCommandCentreCostingState, summarizeCommandCentreDesign } from './summarizeDesign';
import {
  COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT,
  commandCentreQuoteDeliveryState,
  normalizeCommandCentreCommercialCandidates,
} from './commercialSelection';
import type {
  CommandCentreEstimateCandidate,
  CommandCentreStatusTone,
  ProjectCommandCentreCurrentDesign,
  ProjectCommandCentreResponse,
} from './types';

const PROJECT_COMMAND_CENTRE_SELECT = `
  id,
  pipeline_stage,
  ownerAssignment:project_owner_assignments(owner_key,updated_at),
  ${COMMAND_CENTRE_COMMERCIAL_RELATIONS_SELECT}
`;

type AnyRecord = Record<string, unknown>;

function relationRows(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isoTimestamp(value: unknown): string | null {
  const raw = trimmedString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseRecord(value: unknown): AnyRecord | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storedEstimateFromRow(row: AnyRecord, candidate: CommandCentreEstimateCandidate): Estimate | null {
  const inputs = parseRecord(row.inputs);
  const outputs = parseRecord(row.outputs);
  if (!inputs || !outputs) return null;

  const configVersions = parseRecord(outputs.configVersions);
  return {
    id: candidate.id,
    projectId: appIdFromUuid('proj', String(row.project_id ?? '')),
    version: positiveInteger(row.version) ?? undefined,
    createdAt: isoTimestamp(row.created_at) ?? candidate.createdAt ?? new Date(0).toISOString(),
    updatedAt: isoTimestamp(row.updated_at) ?? undefined,
    status: candidate.status === 'archived' ? 'archived' : 'draft',
    inputs: inputs as unknown as Estimate['inputs'],
    derived: (parseRecord(outputs.derived) ?? {}) as Estimate['derived'],
    projectSnapshot: (parseRecord(outputs.projectSnapshot) ?? undefined) as Estimate['projectSnapshot'],
    snapshot: (parseRecord(outputs.snapshot) ?? undefined) as Estimate['snapshot'],
    outputs: outputs as unknown as Estimate['outputs'],
    configVersions: {
      pricebook: trimmedString(configVersions?.pricebook) ?? '',
      installActions: trimmedString(configVersions?.installActions) ?? '',
      overheads: trimmedString(configVersions?.overheads) ?? '',
      rules: trimmedString(configVersions?.rules) ?? trimmedString(row.costing_rules) ?? '',
      manifest: trimmedString(configVersions?.manifest) ?? trimmedString(row.costing_manifest) ?? '',
    },
  };
}

function statusPresentation(source: ProjectCommandCentreResponse['currentDesign']['source']): {
  label: string;
  tone: CommandCentreStatusTone;
} {
  if (source === 'accepted_quote') return { label: 'Quote accepted', tone: 'accepted' };
  if (source === 'sent_quote') return { label: 'Quote sent', tone: 'sent' };
  if (source === 'draft_quote') return { label: 'Draft quote', tone: 'draft' };
  if (source === 'estimate') return { label: 'Estimate current', tone: 'neutral' };
  return { label: 'No current design', tone: 'neutral' };
}

export async function getProjectCommandCentre(
  projectId: string,
  supabase: SupabaseClient,
  viewer: { userId: string; isAdmin: boolean } = { userId: '', isAdmin: false },
): Promise<ProjectCommandCentreResponse | null> {
  let projectUuid: string;
  try {
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return null;
  }

  const [projectResult, usesV2ProjectWork] = await Promise.all([
    supabase.from('projects').select(PROJECT_COMMAND_CENTRE_SELECT).eq('id', projectUuid).maybeSingle(),
    isProjectWorkModelV2(supabase, projectUuid),
  ]);
  if (projectResult.error) throw new Error(projectResult.error.message ?? 'Failed to load command centre');
  if (!projectResult.data) return null;

  const projectRow = projectResult.data as AnyRecord;
  const stage = String(projectRow.pipeline_stage ?? 'new')
    .trim()
    .toLowerCase();
  const { quotes, estimates } = normalizeCommandCentreCommercialCandidates(projectRow);
  const selection = resolveCommandCentreSelection({
    estimates,
    quoteVersions: quotes,
  });

  let selectedDetail: AnyRecord | null = null;
  if (selection.estimate) {
    const estimateResult = await supabase
      .from('estimates')
      .select('id,project_id,created_at,updated_at,status,version,inputs,outputs,costing_manifest,costing_rules')
      .eq('id', selection.estimate.sourceId)
      .maybeSingle();
    if (estimateResult.error || !estimateResult.data) {
      throw new Error(estimateResult.error?.message ?? 'Selected estimate detail unavailable');
    }
    selectedDetail = estimateResult.data as AnyRecord;
  }

  const status = statusPresentation(selection.source);
  const quoteSelected = selection.quote !== null;
  const designState = selection.sourceEstimateMissing
    ? 'source_unavailable'
    : selection.estimate
      ? 'available'
      : 'none';
  const warnings: ProjectCommandCentreResponse['currentDesign']['warnings'] = [];
  if (selection.acceptedQuoteCount > 1) warnings.push('multiple_accepted_quotes');
  if (selection.sourceEstimateMissing) warnings.push('source_design_unavailable');
  const quotePriceUnavailable = selection.source === 'accepted_quote'
    ? selection.acceptedProjectTotalIncGstCents === null
    : selection.quote?.totalIncGstCents === null;
  if (quoteSelected && quotePriceUnavailable) warnings.push('quote_price_unavailable');

  const basePath = `/staff/projects/${encodeURIComponent(projectId)}`;
  const estimate = selection.estimate;
  const quote = selection.quote;
  let estimatePriceIncGstCents: number | null = null;
  if (!quote && estimate && selectedDetail) {
    const storedEstimate = storedEstimateFromRow(selectedDetail, estimate);
    if (storedEstimate) {
      const preview = buildQuoteHandoffPreviewFromEstimate(storedEstimate);
      if (preview.blockingIssues.length === 0 && preview.totalIncGstCents > 0) {
        estimatePriceIncGstCents = preview.totalIncGstCents;
      }
    }
    if (estimatePriceIncGstCents === null) warnings.push('estimate_price_unavailable');
  }
  const currentDesign: ProjectCommandCentreCurrentDesign = {
    source: selection.source,
    statusLabel: status.label,
    statusTone: status.tone,
    designState,
    design: selectedDetail ? summarizeCommandCentreDesign(selectedDetail.inputs) : null,
    price: quote
      ? {
          source: 'quote',
          totalIncGstCents: selection.source === 'accepted_quote'
            ? selection.acceptedProjectTotalIncGstCents
            : quote.totalIncGstCents,
        }
      : estimate
        ? { source: 'estimate', totalIncGstCents: estimatePriceIncGstCents }
        : { source: 'none', totalIncGstCents: null },
    estimate: estimate
      ? {
          id: estimate.id,
          versionLabel: estimate.versionLabel,
          savedAt: estimate.createdAt,
          isActiveDraft: estimate.status === 'draft' && !estimate.isLocked,
          isLocked: estimate.isLocked,
          isQuoteSource: quoteSelected,
          costingState: resolveCommandCentreCostingState(selectedDetail?.outputs),
        }
      : null,
    quote: quote
      ? {
          id: quote.id,
          quoteRef: quote.quoteRef,
          versionNumber: quote.versionNumber,
          status: quote.status,
          createdAt: quote.createdAt,
          sentAt: quote.sentAt,
          deliveryState: commandCentreQuoteDeliveryState(quote),
        }
      : null,
    newerEstimate: selection.newerEstimate
      ? {
          id: selection.newerEstimate.id,
          versionLabel: selection.newerEstimate.versionLabel,
          savedAt: selection.newerEstimate.createdAt,
        }
      : null,
    latestDeclinedQuote:
      !quote && selection.latestDeclinedQuote
        ? {
            quoteVersionId: selection.latestDeclinedQuote.id,
            quoteRef: selection.latestDeclinedQuote.quoteRef,
            versionNumber: selection.latestDeclinedQuote.versionNumber,
            createdAt: selection.latestDeclinedQuote.createdAt,
          }
        : null,
    warnings,
    links: {
      designs: `${basePath}?tab=estimates`,
      quotes: `${basePath}?tab=quotes`,
      estimate: estimate ? `${basePath}?tab=estimates&estimateId=${encodeURIComponent(estimate.id)}` : null,
      quote: quote ? `${basePath}?tab=quotes&quoteId=${encodeURIComponent(quote.id)}` : null,
    },
  };

  const common = {
    projectId,
    generatedAt: new Date().toISOString(),
    currentDesign,
  };
  const ownerRow = relationRows(projectRow.ownerAssignment)[0];
  const owner = buildProjectOwnerSummary({
    stage,
    assignment:
      ownerRow && trimmedString(ownerRow.owner_key)
        ? {
            ownerKey: String(ownerRow.owner_key),
            updatedAt: isoTimestamp(ownerRow.updated_at) ?? new Date(0).toISOString(),
          }
        : null,
    isAdmin: viewer.isAdmin,
  });
  if (usesV2ProjectWork) {
    const domainActions = await getProjectWorkDomainActions({
      supabase,
      projectId,
      projectUuid,
      stage,
      currentDesign,
    });
    const projectWork = await getProjectWorkProjection({
      supabase,
      projectUuid,
      ...domainActions,
    });
    if (!projectWork) throw new Error('V2 project work could not be loaded');
    return {
      ...common,
      workModel: 'v2',
      projectWork,
      owner,
    };
  }

  return {
    ...common,
    workModel: 'legacy',
    legacyWork: {
      status: 'retired',
    },
    owner,
  };
}
