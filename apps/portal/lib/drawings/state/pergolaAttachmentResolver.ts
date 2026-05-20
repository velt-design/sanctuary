import {
  normalizeAttachmentSide,
  type CalculatorHouseAttachmentStrategy,
  type CalculatorModuleInputs,
} from '@/lib/types/calculator';
import type {
  HouseAttachmentZoneKind,
  HouseFirstMigrationWarning,
  HouseFirstPergolaDraft,
  HouseModel,
  PergolaModel,
} from './houseFirstWorkbenchModel';

/**
 * Pergola → house attachment resolver. Extracted from
 * `houseFirstWorkbenchAdapter.buildPergolas` so the per-pergola attachment
 * logic (kind classification, host-zone resolution, fallback chain,
 * blocking-warning emission) is a single focused module.
 *
 * The extraction is also a prerequisite for multi-house-form support —
 * once `houseForms[]` becomes a real array of N forms,
 * `resolvePergolaAttachment` can be called per pergola with the
 * envelope lookup for the chosen host form (looked up via
 * `pergola.attachment.host.objectId`) instead of "the" shared house.
 *
 * Resolution fallback chain (preserved byte-for-byte from the original):
 *   1. `attachmentKind === 'freestanding'` -> resolved with null host
 *   2. No `derivedEnvelope` -> unresolved, blocking warning
 *   3. Explicit `attachmentZoneId` -> resolve against it, error if missing
 *   4. Explicit `attachmentEdgeId` -> resolve via zonesByEdgeId, error if
 *      multiple compatible zones share the edge
 *   5. Legacy side+kind heuristic -> resolve when exactly one zone matches,
 *      ambiguous when multiple, unresolved otherwise
 *
 * Behaviour is byte-identical to the original inline implementation.
 */

/**
 * Lookup maps over a `HouseModel.derivedEnvelope` for fast attachment
 * resolution. Built once per house and reused across N pergolas.
 */
export type HouseEnvelopeLookup = {
  derivedEnvelope: HouseModel['derivedEnvelope'] | null;
  edgesById: Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>;
  zonesById: Map<string, NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>;
  zonesByEdgeId: Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>;
  zonesBySideAndKind: Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>;
};

export function buildHouseEnvelopeLookup(house: HouseModel | null): HouseEnvelopeLookup {
  const derivedEnvelope = house?.derivedEnvelope ?? null;
  const zonesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>();
  const edgesById = new Map<string, NonNullable<HouseModel['derivedEnvelope']>['edges'][number]>();
  const zonesByEdgeId = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  const zonesBySideAndKind = new Map<string, Array<NonNullable<HouseModel['derivedEnvelope']>['attachmentZones'][number]>>();
  for (const edge of derivedEnvelope?.edges ?? []) {
    edgesById.set(edge.id, edge);
  }
  for (const zone of derivedEnvelope?.attachmentZones ?? []) {
    zonesById.set(zone.id, zone);
    if (zone.hostEdgeId) {
      const edgeZones = zonesByEdgeId.get(zone.hostEdgeId) ?? [];
      edgeZones.push(zone);
      zonesByEdgeId.set(zone.hostEdgeId, edgeZones);
    }
    const sideKey = `${zone.side}:${zone.kind}`;
    const sideZones = zonesBySideAndKind.get(sideKey) ?? [];
    sideZones.push(zone);
    zonesBySideAndKind.set(sideKey, sideZones);
  }
  return { derivedEnvelope, edgesById, zonesById, zonesByEdgeId, zonesBySideAndKind };
}

export function resolvePergolaFamily(module: CalculatorModuleInputs): PergolaModel['family'] {
  if (module.boxPerimeterEnabled) return 'box';
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  if (module.pergolaStyle === 'pitched') return 'mono';
  return 'unknown';
}

export function resolvePergolaAttachmentKind(
  module: CalculatorModuleInputs,
): PergolaModel['attachment']['kind'] {
  if (module.houseConnectionType === 'none') return 'freestanding';
  if (module.houseConnectionType === 'facade') return 'wall';
  return module.houseConnectionType;
}

export function resolveAttachmentStrategyZoneKinds(
  strategy: CalculatorHouseAttachmentStrategy | null,
): HouseAttachmentZoneKind[] {
  if (strategy === 'none') return [];
  const kinds = new Set<HouseAttachmentZoneKind>();
  if (strategy === 'facade_ledger' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('wall');
  }
  if (strategy === 'soffit_brackets' || strategy === 'post_supported_tieback' || strategy === null) {
    kinds.add('soffit');
  }
  if (strategy === 'fascia_under_gutter' || strategy === null) {
    kinds.add('fascia');
  }
  if (strategy === 'fascia_under_gutter') {
    kinds.add('roof_edge');
  }
  return Array.from(kinds);
}

export function normalizePergolaAttachmentZoneId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizePergolaAttachmentEdgeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^footprint-edge-\d+$/.test(trimmed) ? trimmed : null;
}

export type PergolaAttachmentResolutionInput = {
  pergolaId: string;
  moduleInput: CalculatorModuleInputs;
  draft: HouseFirstPergolaDraft | null;
  /** First module's index in this pergola's group — only used for warning provenance. */
  firstModuleIndex: number;
  envelope: HouseEnvelopeLookup;
};

export type PergolaAttachmentResolutionResult = {
  attachment: PergolaModel['attachment'];
  warning: HouseFirstMigrationWarning | null;
};

/**
 * Pure per-pergola attachment resolution. Mirrors the inline logic that
 * lived in `buildPergolas` — preserve behaviour exactly. The caller still
 * owns module grouping (one pergola can come from many modules) and
 * final `PergolaModel` assembly (id, label, family, sourceModule*).
 */
export function resolvePergolaAttachment(
  input: PergolaAttachmentResolutionInput,
): PergolaAttachmentResolutionResult {
  const { pergolaId, moduleInput, draft, firstModuleIndex, envelope } = input;
  const attachmentKind = resolvePergolaAttachmentKind(moduleInput);
  const normalizedAttachmentSide = normalizeAttachmentSide(
    moduleInput.attachmentSide ?? 'rear',
  ) as NonNullable<CalculatorModuleInputs['attachmentSide']>;
  const zoneKind = attachmentKind === 'freestanding'
    ? null
    : attachmentKind === 'wall'
      ? 'wall'
      : attachmentKind;
  const requestedAttachmentZoneId = normalizePergolaAttachmentZoneId(draft?.attachmentZoneId);
  const requestedAttachmentEdgeId = normalizePergolaAttachmentEdgeId(draft?.attachmentEdgeId);
  let attachmentEdgeId =
    attachmentKind === 'freestanding'
      ? null
      : requestedAttachmentEdgeId;
  let attachmentZoneId =
    attachmentKind === 'freestanding'
      ? null
      : requestedAttachmentZoneId;
  let houseAttachmentZoneId: string | null = null;
  let resolvedAttachmentSide = normalizedAttachmentSide;
  let resolutionStatus: PergolaModel['attachment']['resolution']['status'] =
    attachmentKind === 'freestanding' ? 'resolved' : 'unresolved';
  let resolutionMessage: string | null = null;

  if (zoneKind === null) {
    attachmentEdgeId = null;
    attachmentZoneId = null;
  } else if (!envelope.derivedEnvelope) {
    resolutionMessage = 'This pergola no longer has a derived building envelope to attach to.';
  } else if (requestedAttachmentZoneId !== null) {
    const requestedZone = envelope.zonesById.get(requestedAttachmentZoneId) ?? null;
    if (requestedZone && requestedZone.kind === zoneKind && requestedZone.hostEdgeId) {
      attachmentZoneId = requestedZone.id;
      attachmentEdgeId = requestedZone.hostEdgeId;
      houseAttachmentZoneId = requestedZone.id;
      resolvedAttachmentSide = requestedZone.side;
      resolutionStatus = 'resolved';
    } else {
      resolutionMessage =
        `The saved ${zoneKind.replace('_', ' ')} host zone for this pergola is no longer available. Select a new host zone.`;
    }
  } else if (requestedAttachmentEdgeId !== null) {
    const compatibleZones = (envelope.zonesByEdgeId.get(requestedAttachmentEdgeId) ?? []).filter(
      (zone) => zone.kind === zoneKind,
    );
    const requestedEdge = envelope.edgesById.get(requestedAttachmentEdgeId) ?? null;
    if (requestedEdge && compatibleZones.length === 1) {
      const resolvedZone = compatibleZones[0]!;
      attachmentEdgeId = requestedEdge.id;
      attachmentZoneId = resolvedZone.id;
      houseAttachmentZoneId = resolvedZone.id;
      resolvedAttachmentSide = resolvedZone.side;
      resolutionStatus = 'resolved';
    } else {
      resolutionMessage =
        compatibleZones.length > 1
          ? `The saved host edge now resolves to multiple compatible ${zoneKind.replace('_', ' ')} zones. Select one explicitly.`
          : `The saved host edge no longer supports a ${zoneKind.replace('_', ' ')} attachment for this pergola. Select a new host edge.`;
    }
  } else {
    const legacyZones = envelope.zonesBySideAndKind.get(`${normalizedAttachmentSide}:${zoneKind}`) ?? [];
    if (legacyZones.length === 1) {
      const resolvedZone = legacyZones[0]!;
      attachmentEdgeId = resolvedZone.hostEdgeId ?? null;
      attachmentZoneId = resolvedZone.id;
      houseAttachmentZoneId = resolvedZone.id;
      resolvedAttachmentSide = resolvedZone.side;
      resolutionStatus = 'resolved';
    } else if (legacyZones.length > 1) {
      resolutionStatus = 'ambiguous';
      resolutionMessage =
        `Multiple compatible ${zoneKind.replace('_', ' ')} host edges exist on the ${normalizedAttachmentSide} side. Select the correct host edge for this pergola.`;
    } else {
      resolutionMessage =
        `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`;
    }
  }

  let warning: HouseFirstMigrationWarning | null = null;
  if (zoneKind && resolutionStatus !== 'resolved') {
    const warningField =
      requestedAttachmentZoneId !== null
        ? `houseFirst.pergolas.${pergolaId}.attachmentZoneId`
        : requestedAttachmentEdgeId !== null
          ? `houseFirst.pergolas.${pergolaId}.attachmentEdgeId`
          : `inputs.modules.${firstModuleIndex}.attachmentSide`;
    warning = {
      id: `house-attachment-zone-${pergolaId}`,
      code: 'invalid_house_attachment_zone_overlay',
      severity: 'blocking',
      field: warningField,
      chosenModuleIndex: firstModuleIndex,
      conflictingModuleIndexes: [],
      message:
        resolutionMessage ??
        `The shared house no longer exposes a valid ${normalizedAttachmentSide} ${zoneKind.replace('_', ' ')} host zone for this pergola.`,
    };
  }

  return {
    attachment: {
      id: `attachment-${pergolaId}`,
      kind: attachmentKind,
      attachmentEdgeId,
      attachmentZoneId,
      houseAttachmentZoneId,
      side: resolvedAttachmentSide,
      strategy: pickFirstDefined(moduleInput.houseAttachmentStrategy, null),
      resolution: {
        status: resolutionStatus,
        message: resolutionMessage,
      },
    },
    warning,
  };
}

function pickFirstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}
