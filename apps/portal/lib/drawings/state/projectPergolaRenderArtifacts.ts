import {
  solvePergolaGeometry,
  type AttachmentSide,
  type ConnectionType,
  type PergolaGeometryInput,
} from '@sp/geometry';
import { resolveObjectFirstPergolaAttachment } from './objectFirstDerivedHosting';
import type {
  PergolaAttachmentMethod,
  PergolaObjectModel,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';
import type { ProjectPergolaRenderArtifact } from './projectObjectRenderPipeline';
import type {
  WorkbenchGeometryIdentity,
  WorkbenchTrustStatus,
  WorkbenchTrustStatusKind,
} from './workbenchSolvedModel';

type ResolvedPergolaHost =
  | {
      status: 'ready';
      house: ProjectHouseGeometryEntry | null;
      attachmentSide: AttachmentSide;
      connectionType: ConnectionType;
      attachmentStrategy: PergolaGeometryInput['connection']['attachmentStrategy'];
    }
  | {
      status: 'blocked';
      trustStatus: WorkbenchTrustStatusKind;
      message: string;
    };

function buildTrustStatus(input: {
  status: WorkbenchTrustStatusKind;
  renderSource?: 'geometry' | 'none';
  message?: string | null;
}): WorkbenchTrustStatus {
  return {
    status: input.status,
    issues: input.status === 'geometry_ready' ? [] : [input.status],
    renderSource: input.renderSource ?? 'none',
    message: input.message ?? null,
  };
}

function failedArtifact(input: {
  pergolaId: string;
  trustStatus: WorkbenchTrustStatusKind;
  message: string;
}): ProjectPergolaRenderArtifact {
  return {
    artifactId: `pergola:${input.pergolaId}`,
    pergolaId: input.pergolaId,
    renderStatus: 'invalid_geometry',
    trust: buildTrustStatus({
      status: input.trustStatus,
      message: input.message,
    }),
    assembly: null,
    geometryTopProjection: null,
    viewerScene: null,
  };
}

function connectionTypeFromMethod(method: PergolaAttachmentMethod | null | undefined): ConnectionType {
  if (method === 'facade_ledger') return 'wall';
  if (method === 'fascia_under_gutter') return 'fascia';
  if (method === 'direct_to_soffit' || method === 'soffit_brackets') return 'soffit';
  return 'freestanding';
}

function connectionTypeFromPergola(pergola: PergolaObjectModel): ConnectionType {
  if (pergola.attachment) {
    return connectionTypeFromMethod(pergola.attachment.method);
  }
  if (pergola.connectionKind === 'wall') return 'wall';
  if (pergola.connectionKind === 'fascia') return 'fascia';
  if (pergola.connectionKind === 'soffit') return 'soffit';
  if (pergola.strategy === 'facade_ledger') return 'wall';
  if (pergola.strategy === 'fascia_under_gutter') return 'fascia';
  if (pergola.strategy === 'soffit_brackets' || pergola.strategy === 'post_supported_tieback') {
    return 'soffit';
  }
  return 'freestanding';
}

function attachmentStrategyFromPergola(
  pergola: PergolaObjectModel,
): PergolaGeometryInput['connection']['attachmentStrategy'] {
  if (pergola.attachment) {
    if (pergola.attachment.method === 'none') return 'none';
    if (pergola.attachment.method === 'direct_to_soffit') return 'soffit_brackets';
    return pergola.attachment.method;
  }
  return pergola.strategy ?? (connectionTypeFromPergola(pergola) === 'freestanding' ? 'none' : 'soffit_brackets');
}

function isFreestandingPergola(pergola: PergolaObjectModel): boolean {
  if (pergola.attachment) return pergola.attachment.spatialKind === 'freestanding';
  return connectionTypeFromPergola(pergola) === 'freestanding';
}

function findHouseById(
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>,
  houseFormId: string | null | undefined,
): ProjectHouseGeometryEntry | null {
  if (!houseFormId) return null;
  return projectHouseGeometries.find((entry) => entry.houseFormId === houseFormId) ?? null;
}

function attachmentSideForHost(input: {
  projectModel: WorkbenchProjectModel;
  hostObjectId: string;
  hostEdgeId: string | null;
  fallback: AttachmentSide;
}): AttachmentSide {
  const zones = input.projectModel.houseAssembly?.derivedEnvelope?.attachmentZones ?? [];
  const zone = zones.find(
    (candidate) =>
      candidate.hostEdgeId === input.hostEdgeId &&
      candidate.sourceFormIds.includes(input.hostObjectId),
  );
  return zone?.side ?? input.fallback;
}

function resolveHost(input: {
  projectModel: WorkbenchProjectModel;
  pergola: PergolaObjectModel;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ResolvedPergolaHost {
  const connectionType = connectionTypeFromPergola(input.pergola);
  const attachmentStrategy = attachmentStrategyFromPergola(input.pergola);
  if (isFreestandingPergola(input.pergola)) {
    return {
      status: 'ready',
      house: null,
      attachmentSide: input.pergola.side,
      connectionType: 'freestanding',
      attachmentStrategy: 'none',
    };
  }

  const snapHost = input.pergola.attachment?.host ?? null;
  if (snapHost?.objectFamily === 'pergolas') {
    return {
      status: 'blocked',
      trustStatus: 'unresolved_host',
      message: `Pergola ${input.pergola.id} is hosted by another pergola, which is diagnostic-only in this slice.`,
    };
  }
  if (snapHost?.objectFamily === 'house_forms') {
    const house = findHouseById(input.projectHouseGeometries, snapHost.objectId);
    if (!house) {
      return {
        status: 'blocked',
        trustStatus: 'unresolved_host',
        message: `Pergola ${input.pergola.id} references missing host house ${snapHost.objectId}.`,
      };
    }
    return {
      status: 'ready',
      house,
      attachmentSide: attachmentSideForHost({
        projectModel: input.projectModel,
        hostObjectId: snapHost.objectId,
        hostEdgeId: snapHost.edgeId,
        fallback: input.pergola.side,
      }),
      connectionType,
      attachmentStrategy,
    };
  }

  const fallback = resolveObjectFirstPergolaAttachment({
    houseAssembly: input.projectModel.houseAssembly,
    pergola: input.pergola,
  });
  if (fallback.status !== 'resolved') {
    return {
      status: 'blocked',
      trustStatus: 'unresolved_host',
      message: `Pergola ${input.pergola.id} has an unresolved host (${fallback.code ?? 'unknown'}).`,
    };
  }

  const sourceFormIds = fallback.zone?.sourceFormIds ?? fallback.edge?.sourceFormIds ?? [];
  const house = sourceFormIds
    .map((houseFormId) => findHouseById(input.projectHouseGeometries, houseFormId))
    .find((entry): entry is ProjectHouseGeometryEntry => Boolean(entry)) ?? null;
  if (!house) {
    return {
      status: 'blocked',
      trustStatus: 'unresolved_host',
      message: `Pergola ${input.pergola.id} could not resolve a solved host house.`,
    };
  }

  return {
    status: 'ready',
    house,
    attachmentSide: fallback.zone?.side ?? input.pergola.side,
    connectionType,
    attachmentStrategy,
  };
}

function pergolaPosition(input: PergolaObjectModel['position']): PergolaGeometryInput['position'] {
  return {
    origin: {
      x: input?.originXMm ?? 0,
      y: input?.originYMm ?? 0,
    },
    rotationDeg: input?.rotationDeg ?? 0,
  };
}

function pergolaGeometryInput(input: {
  pergola: PergolaObjectModel;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
  host: Extract<ResolvedPergolaHost, { status: 'ready' }>;
}): PergolaGeometryInput {
  const geometry = input.pergola.geometry ?? null;
  const roof = geometry?.roof ?? null;
  const gable = geometry?.gable ?? null;
  const supports = geometry?.supports ?? null;
  const overrides = geometry?.overrides ?? null;
  return {
    projectId: input.geometryIdentity.projectId,
    estimateId: input.geometryIdentity.estimateId,
    designRequestId: input.geometryIdentity.designRequestId,
    family: input.pergola.family,
    dimensions: {
      lengthM: geometry?.dimensions?.lengthM ?? null,
      projectionM: geometry?.dimensions?.projectionM ?? null,
      hipCornerLengthBM: geometry?.dimensions?.hipCornerLengthBM ?? null,
      hipCornerProjectionBM: geometry?.dimensions?.hipCornerProjectionBM ?? null,
    },
    roof: {
      material: roof?.material ?? 'acrylic',
      pitchDeg: roof?.pitchDeg ?? null,
      boxPerimeterEnabled: input.pergola.family === 'box' || roof?.boxPerimeterEnabled === true,
      mixedAcrylicBaysMain: roof?.mixedAcrylicBaysMain ?? null,
      mixedAcrylicBaysA: roof?.mixedAcrylicBaysA ?? null,
      mixedAcrylicBaysB: roof?.mixedAcrylicBaysB ?? null,
      overhangEnabled: false,
    },
    gable: {
      endFramesMode: gable?.endFramesMode ?? null,
      houseEaveGutterMode: gable?.houseEaveGutterMode ?? null,
      outerEaveGutterMode: gable?.outerEaveGutterMode ?? null,
    },
    connection: {
      type: input.host.connectionType,
      attachmentSide: input.host.attachmentSide,
      attachmentStrategy: input.host.attachmentStrategy,
    },
    position: pergolaPosition(input.pergola.position ?? null),
    supports: {
      postCount: supports?.postCount ?? null,
      postCutHeightM: supports?.postCutHeightM ?? null,
      postConnectionType: supports?.postConnectionType ?? null,
      ground: supports?.ground ?? null,
    },
    structural: {
      profiles: {
        post: overrides?.postProfile ?? null,
        rafter: overrides?.rafterProfile ?? null,
        ledger: overrides?.ledgerProfile ?? null,
        supportBeam: overrides?.frontBeamProfile ?? null,
        gutter: null,
        ridge: overrides?.ridgeBeamProfile ?? null,
        tieBeam: overrides?.tieBeamProfile ?? null,
        strut: overrides?.strutProfile ?? null,
        boxPerimeter: overrides?.boxPerimeterBeamProfile ?? null,
      },
    },
    hostHouse: input.host.house?.rawHouseInput ?? null,
  };
}

export function buildProjectPergolaRenderArtifacts(input: {
  projectModel: WorkbenchProjectModel;
  geometryIdentity: Required<WorkbenchGeometryIdentity>;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ProjectPergolaRenderArtifact[] {
  return input.projectModel.pergolas.map((pergola) => {
    const host = resolveHost({
      projectModel: input.projectModel,
      pergola,
      projectHouseGeometries: input.projectHouseGeometries,
    });
    if (host.status === 'blocked') {
      return failedArtifact({
        pergolaId: pergola.id,
        trustStatus: host.trustStatus,
        message: host.message,
      });
    }

    const solved = solvePergolaGeometry(pergolaGeometryInput({
      pergola,
      geometryIdentity: input.geometryIdentity,
      host,
    }));
    if (!solved.ok) {
      return failedArtifact({
        pergolaId: pergola.id,
        trustStatus: 'invalid_geometry',
        message: solved.error,
      });
    }
    return {
      artifactId: `pergola:${pergola.id}`,
      pergolaId: pergola.id,
      renderStatus: 'geometry_ready',
      trust: buildTrustStatus({
        status: solved.validation.status === 'pass' ? 'geometry_ready' : 'approximate',
        renderSource: 'geometry',
        message: solved.validation.status === 'pass' ? null : 'Pergola solved with validation warnings.',
      }),
      assembly: solved.assembly,
      geometryTopProjection: solved.topProjection,
      viewerScene: solved.viewerScene,
    };
  });
}
