import type {
  DerivedAttachmentZoneModel,
  DerivedEnvelopeEdgeModel,
  DerivedWallModel,
  HouseAssemblyModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';

type ObjectFirstOpeningHostResolutionCode =
  | 'missing_assembly'
  | 'missing_envelope'
  | 'missing_host_wall';

export type ObjectFirstOpeningHostResolution = {
  status: 'resolved' | 'unresolved';
  code: ObjectFirstOpeningHostResolutionCode | null;
  hostWallId: string | null;
  wall: DerivedWallModel | null;
};

type ObjectFirstPergolaAttachmentResolutionCode =
  | 'missing_assembly'
  | 'missing_envelope'
  | 'missing_attachment_edge'
  | 'missing_attachment_zone'
  | 'attachment_zone_edge_mismatch';

export type ObjectFirstPergolaAttachmentResolution = {
  status: 'resolved' | 'unresolved';
  code: ObjectFirstPergolaAttachmentResolutionCode | null;
  attachmentEdgeId: string | null;
  attachmentZoneId: string | null;
  edge: DerivedEnvelopeEdgeModel | null;
  zone: DerivedAttachmentZoneModel | null;
};

export function resolveObjectFirstOpeningHost(input: {
  houseAssembly: HouseAssemblyModel | null;
  opening: OpeningObjectModel;
}): ObjectFirstOpeningHostResolution {
  const hostWallId = input.opening.hostWallId;
  if (!input.houseAssembly) {
    return {
      status: 'unresolved',
      code: 'missing_assembly',
      hostWallId,
      wall: null,
    };
  }

  const envelope = input.houseAssembly.derivedEnvelope;
  if (!envelope) {
    return {
      status: 'unresolved',
      code: 'missing_envelope',
      hostWallId,
      wall: null,
    };
  }

  if (!hostWallId) {
    return {
      status: 'unresolved',
      code: 'missing_host_wall',
      hostWallId,
      wall: null,
    };
  }

  const wall = envelope.wallGraph.walls.find((candidate) => candidate.id === hostWallId) ?? null;
  if (!wall) {
    return {
      status: 'unresolved',
      code: 'missing_host_wall',
      hostWallId,
      wall: null,
    };
  }

  return {
    status: 'resolved',
    code: null,
    hostWallId,
    wall,
  };
}

export function resolveObjectFirstPergolaAttachment(input: {
  houseAssembly: HouseAssemblyModel | null;
  pergola: PergolaObjectModel;
}): ObjectFirstPergolaAttachmentResolution {
  const attachmentEdgeId = input.pergola.attachmentEdgeId;
  const attachmentZoneId = input.pergola.attachmentZoneId;
  if (!input.houseAssembly) {
    return {
      status: 'unresolved',
      code: 'missing_assembly',
      attachmentEdgeId,
      attachmentZoneId,
      edge: null,
      zone: null,
    };
  }

  const envelope = input.houseAssembly.derivedEnvelope;
  if (!envelope) {
    return {
      status: 'unresolved',
      code: 'missing_envelope',
      attachmentEdgeId,
      attachmentZoneId,
      edge: null,
      zone: null,
    };
  }

  if (!attachmentEdgeId) {
    return {
      status: 'unresolved',
      code: 'missing_attachment_edge',
      attachmentEdgeId,
      attachmentZoneId,
      edge: null,
      zone: null,
    };
  }

  const edge = envelope.edges.find((candidate) => candidate.id === attachmentEdgeId) ?? null;
  if (!edge) {
    return {
      status: 'unresolved',
      code: 'missing_attachment_edge',
      attachmentEdgeId,
      attachmentZoneId,
      edge: null,
      zone: null,
    };
  }

  if (!attachmentZoneId) {
    return {
      status: 'resolved',
      code: null,
      attachmentEdgeId,
      attachmentZoneId,
      edge,
      zone: null,
    };
  }

  const zone = envelope.attachmentZones.find((candidate) => candidate.id === attachmentZoneId) ?? null;
  if (!zone) {
    return {
      status: 'unresolved',
      code: 'missing_attachment_zone',
      attachmentEdgeId,
      attachmentZoneId,
      edge,
      zone: null,
    };
  }

  if (zone.hostEdgeId !== edge.id) {
    return {
      status: 'unresolved',
      code: 'attachment_zone_edge_mismatch',
      attachmentEdgeId,
      attachmentZoneId,
      edge,
      zone,
    };
  }

  return {
    status: 'resolved',
    code: null,
    attachmentEdgeId,
    attachmentZoneId,
    edge,
    zone,
  };
}
