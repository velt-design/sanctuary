import {
  CUSTOMER_PERGOLA_CONFIGURATION_V1,
  type CustomerAcrylicTintV1,
  type CustomerAttachmentSideV1,
  type CustomerBlindFabricV1,
  type CustomerBlindOperationV1,
  type CustomerConfigurationSourceKindV1,
  type CustomerConnectionIntentV1,
  type CustomerDownlightIntentV1,
  type CustomerEdgeIdV1,
  type CustomerEdgeTreatmentV1,
  type CustomerFrameFinishV1,
  type CustomerHeatingInterestV1,
  type CustomerHouseFootprintV1,
  type CustomerHouseRoofFormV1,
  type CustomerHouseStoreysV1,
  type CustomerMixedRoofLayoutV1,
  type CustomerPergolaConfigurationV1,
  type CustomerPergolaFamilyV1,
  type CustomerPlacementModeV1,
  type CustomerRoofIntentV1,
  type CustomerSiteLevelV1,
} from './contracts';
import {
  CUSTOMER_CUSTOM_COLOUR_NAME_MAX_LENGTH,
  CUSTOMER_DIMENSION_BOUNDS,
  CUSTOMER_EDGE_IDS,
  CUSTOMER_SOURCE_PATH_MAX_LENGTH,
  CUSTOMER_SOURCE_SLUG_MAX_LENGTH,
} from './options';

export type CustomerConfigurationParseIssueCode =
  | 'invalid_type'
  | 'invalid_value'
  | 'invariant'
  | 'out_of_range'
  | 'unknown_key';

export type CustomerConfigurationParseIssue = {
  code: CustomerConfigurationParseIssueCode;
  message: string;
  path: string;
};

export type CustomerConfigurationParseResult =
  | { success: true; data: CustomerPergolaConfigurationV1 }
  | { success: false; issues: CustomerConfigurationParseIssue[] };

export class CustomerConfigurationParseError extends Error {
  readonly issues: CustomerConfigurationParseIssue[];

  constructor(issues: CustomerConfigurationParseIssue[]) {
    super(`Invalid customer pergola configuration (${issues.length} issue${issues.length === 1 ? '' : 's'})`);
    this.name = 'CustomerConfigurationParseError';
    this.issues = issues;
  }
}

type UnknownRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_PATH_PATTERN = /^\/[a-z0-9/_-]*$/i;
const SOURCE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function issue(
  issues: CustomerConfigurationParseIssue[],
  code: CustomerConfigurationParseIssueCode,
  path: string,
  message: string,
) {
  issues.push({ code, message, path });
}

function readRecord(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
  issues: CustomerConfigurationParseIssue[],
): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issue(issues, 'invalid_type', path, 'Expected an object.');
    return {};
  }

  const record = value as UnknownRecord;
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      issue(issues, 'unknown_key', `${path}.${key}`, `Unknown key "${key}".`);
    }
  }
  return record;
}

function readString(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): string {
  if (typeof value !== 'string') {
    issue(issues, 'invalid_type', path, 'Expected a string.');
    return '';
  }
  return value;
}

function readNullableString(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): string | null {
  if (value === null) return null;
  return readString(value, path, issues);
}

function readBoolean(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): boolean {
  if (typeof value !== 'boolean') {
    issue(issues, 'invalid_type', path, 'Expected a boolean.');
    return false;
  }
  return value;
}

function readInteger(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    issue(issues, 'invalid_type', path, 'Expected a safe integer.');
    return 0;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: CustomerConfigurationParseIssue[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issue(issues, 'invalid_value', path, `Expected one of: ${allowed.join(', ')}.`);
    return allowed[0];
  }
  return value as T;
}

function readTimestamp(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): string {
  const timestamp = readString(value, path, issues);
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) {
    issue(issues, 'invalid_value', path, 'Expected an ISO timestamp.');
  }
  return timestamp;
}

function readDimension(
  value: unknown,
  field: keyof typeof CUSTOMER_DIMENSION_BOUNDS,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): number {
  const dimension = readInteger(value, path, issues);
  const bounds = CUSTOMER_DIMENSION_BOUNDS[field];
  if (dimension < bounds.minimum || dimension > bounds.maximum) {
    issue(
      issues,
      'out_of_range',
      path,
      `Expected ${bounds.minimum} to ${bounds.maximum} millimetres.`,
    );
  }
  return dimension;
}

function parseRoof(
  value: unknown,
  path: string,
  issues: CustomerConfigurationParseIssue[],
): CustomerRoofIntentV1 {
  const base = readRecord(value, path, ['system', 'tint', 'ceilingIntent', 'layout'], issues);
  const system = readEnum(base.system, ['acrylic', 'solid_timber_sarking', 'mixed'] as const, `${path}.system`, issues);

  if (system === 'solid_timber_sarking') {
    for (const key of ['tint', 'layout']) {
      if (key in base) issue(issues, 'unknown_key', `${path}.${key}`, `${key} is not valid for a solid roof.`);
    }
    return {
      system,
      ceilingIntent: readEnum(base.ceilingIntent, ['natural_timber'] as const, `${path}.ceilingIntent`, issues),
    };
  }

  if ('ceilingIntent' in base) {
    issue(issues, 'unknown_key', `${path}.ceilingIntent`, 'ceilingIntent is only valid for a solid roof.');
  }
  const tint = readEnum<CustomerAcrylicTintV1>(
    base.tint,
    ['clear', 'light_grey', 'dark_grey', 'opal'],
    `${path}.tint`,
    issues,
  );
  if (system === 'mixed') {
    return {
      system,
      tint,
      layout: readEnum<CustomerMixedRoofLayoutV1>(
        base.layout,
        ['central_skylight_narrow', 'central_skylight_standard', 'central_skylight_wide'],
        `${path}.layout`,
        issues,
      ),
    };
  }
  if ('layout' in base) {
    issue(issues, 'unknown_key', `${path}.layout`, 'layout is only valid for a mixed roof.');
  }
  return { system, tint };
}

function parseEdgeTreatment(
  value: unknown,
  index: number,
  issues: CustomerConfigurationParseIssue[],
): CustomerEdgeTreatmentV1 {
  const path = `$.intent.pergola.edgeTreatments[${index}]`;
  const edge = readRecord(value, path, ['edgeId', 'treatment'], issues);
  const edgeId = readEnum<CustomerEdgeIdV1>(edge.edgeId, CUSTOMER_EDGE_IDS, `${path}.edgeId`, issues);
  const treatmentPath = `${path}.treatment`;
  const treatment = readRecord(edge.treatment, treatmentPath, ['kind', 'fabric', 'operation', 'tint'], issues);
  const kind = readEnum(treatment.kind, ['none', 'blind', 'fixed_acrylic'] as const, `${treatmentPath}.kind`, issues);

  if (kind === 'blind') {
    if ('tint' in treatment) issue(issues, 'unknown_key', `${treatmentPath}.tint`, 'tint is not valid for a blind.');
    return {
      edgeId,
      treatment: {
        kind,
        fabric: readEnum<CustomerBlindFabricV1>(
          treatment.fabric,
          ['mesh', 'fine_mesh', 'clear_pvc'],
          `${treatmentPath}.fabric`,
          issues,
        ),
        operation: readEnum<CustomerBlindOperationV1>(
          treatment.operation,
          ['manual', 'motorised'],
          `${treatmentPath}.operation`,
          issues,
        ),
      },
    };
  }

  if (kind === 'fixed_acrylic') {
    for (const key of ['fabric', 'operation']) {
      if (key in treatment) issue(issues, 'unknown_key', `${treatmentPath}.${key}`, `${key} is not valid for fixed acrylic.`);
    }
    return {
      edgeId,
      treatment: {
        kind,
        tint: readEnum(treatment.tint, ['clear', 'opal'] as const, `${treatmentPath}.tint`, issues),
      },
    };
  }

  for (const key of ['fabric', 'operation', 'tint']) {
    if (key in treatment) issue(issues, 'unknown_key', `${treatmentPath}.${key}`, `${key} is not valid for no treatment.`);
  }
  return { edgeId, treatment: { kind } };
}

export function safeParseCustomerPergolaConfigurationV1(
  value: unknown,
): CustomerConfigurationParseResult {
  const issues: CustomerConfigurationParseIssue[] = [];
  const root = readRecord(
    value,
    '$',
    ['schemaVersion', 'configurationId', 'revision', 'createdAt', 'updatedAt', 'source', 'intent'],
    issues,
  );
  const schemaVersion = readEnum(
    root.schemaVersion,
    [CUSTOMER_PERGOLA_CONFIGURATION_V1] as const,
    '$.schemaVersion',
    issues,
  );
  const configurationId = readString(root.configurationId, '$.configurationId', issues);
  if (!UUID_PATTERN.test(configurationId)) {
    issue(issues, 'invalid_value', '$.configurationId', 'Expected a UUID.');
  }
  const revision = readInteger(root.revision, '$.revision', issues);
  if (revision < 1) issue(issues, 'out_of_range', '$.revision', 'Revision must be positive.');
  const createdAt = readTimestamp(root.createdAt, '$.createdAt', issues);
  const updatedAt = readTimestamp(root.updatedAt, '$.updatedAt', issues);
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    issue(issues, 'invariant', '$.updatedAt', 'updatedAt must not precede createdAt.');
  }

  const sourceRecord = readRecord(root.source, '$.source', ['kind', 'sourcePath', 'sourceSlug'], issues);
  const sourceKind = readEnum<CustomerConfigurationSourceKindV1>(
    sourceRecord.kind,
    ['blank', 'simple_cover_import', 'product_seed', 'project_seed'],
    '$.source.kind',
    issues,
  );
  const sourcePath = readNullableString(sourceRecord.sourcePath, '$.source.sourcePath', issues);
  const sourceSlug = readNullableString(sourceRecord.sourceSlug, '$.source.sourceSlug', issues);
  if (sourcePath !== null && (
    sourcePath.length > CUSTOMER_SOURCE_PATH_MAX_LENGTH
    || !SOURCE_PATH_PATTERN.test(sourcePath)
  )) {
    issue(issues, 'invalid_value', '$.source.sourcePath', 'Expected a bounded root-relative path without a query or origin.');
  }
  if (sourceSlug !== null && (
    sourceSlug.length > CUSTOMER_SOURCE_SLUG_MAX_LENGTH
    || !SOURCE_SLUG_PATTERN.test(sourceSlug)
  )) {
    issue(issues, 'invalid_value', '$.source.sourceSlug', 'Expected a bounded lowercase slug.');
  }
  if (sourceKind === 'blank' && (sourcePath !== null || sourceSlug !== null)) {
    issue(issues, 'invariant', '$.source', 'Blank configurations cannot carry a source path or slug.');
  }
  if ((sourceKind === 'product_seed' || sourceKind === 'project_seed') && sourceSlug === null) {
    issue(issues, 'invariant', '$.source.sourceSlug', 'Seeded configurations require a source slug.');
  }

  const intent = readRecord(root.intent, '$.intent', ['pergola', 'site'], issues);
  const pergola = readRecord(
    intent.pergola,
    '$.intent.pergola',
    ['id', 'family', 'dimensions', 'placement', 'frame', 'roof', 'edgeTreatments', 'lighting', 'heatingInterest'],
    issues,
  );
  const pergolaId = readEnum(pergola.id, ['pergola-1'] as const, '$.intent.pergola.id', issues);
  const family = readEnum<CustomerPergolaFamilyV1>(
    pergola.family,
    ['mono', 'gable', 'hip', 'box'],
    '$.intent.pergola.family',
    issues,
  );
  const dimensions = readRecord(
    pergola.dimensions,
    '$.intent.pergola.dimensions',
    ['lengthMm', 'projectionMm', 'clearHeightMm'],
    issues,
  );
  const lengthMm = readDimension(dimensions.lengthMm, 'lengthMm', '$.intent.pergola.dimensions.lengthMm', issues);
  const projectionMm = readDimension(dimensions.projectionMm, 'projectionMm', '$.intent.pergola.dimensions.projectionMm', issues);
  const clearHeightMm = readDimension(dimensions.clearHeightMm, 'clearHeightMm', '$.intent.pergola.dimensions.clearHeightMm', issues);

  const placement = readRecord(
    pergola.placement,
    '$.intent.pergola.placement',
    ['mode', 'attachmentSide', 'connectionIntent'],
    issues,
  );
  const placementMode = readEnum<CustomerPlacementModeV1>(
    placement.mode,
    ['attached', 'freestanding'],
    '$.intent.pergola.placement.mode',
    issues,
  );
  const attachmentSide = readEnum<CustomerAttachmentSideV1>(
    placement.attachmentSide,
    ['rear', 'front', 'left', 'right'],
    '$.intent.pergola.placement.attachmentSide',
    issues,
  );
  const connectionIntent = readEnum<CustomerConnectionIntentV1>(
    placement.connectionIntent,
    ['unsure', 'soffit', 'fascia', 'wall', 'none'],
    '$.intent.pergola.placement.connectionIntent',
    issues,
  );
  if (placementMode === 'freestanding' && connectionIntent !== 'none') {
    issue(issues, 'invariant', '$.intent.pergola.placement.connectionIntent', 'Freestanding configurations require connectionIntent "none".');
  }
  if (placementMode === 'attached' && connectionIntent === 'none') {
    issue(issues, 'invariant', '$.intent.pergola.placement.connectionIntent', 'Attached configurations require a house connection intent.');
  }

  const frame = readRecord(pergola.frame, '$.intent.pergola.frame', ['finish', 'otherColourName'], issues);
  const frameFinish = readEnum<CustomerFrameFinishV1>(
    frame.finish,
    ['black', 'white', 'other'],
    '$.intent.pergola.frame.finish',
    issues,
  );
  const otherColourName = readNullableString(
    frame.otherColourName,
    '$.intent.pergola.frame.otherColourName',
    issues,
  );
  if (otherColourName !== null && (
    otherColourName.trim().length === 0
    || otherColourName.length > CUSTOMER_CUSTOM_COLOUR_NAME_MAX_LENGTH
  )) {
    issue(issues, 'out_of_range', '$.intent.pergola.frame.otherColourName', 'Other colour name must be 1 to 80 characters.');
  }
  if (otherColourName !== null && /(?:https?:\/\/|www\.|@)/i.test(otherColourName)) {
    issue(issues, 'invalid_value', '$.intent.pergola.frame.otherColourName', 'Other colour name cannot contain contact details or a URL.');
  }
  if (frameFinish === 'other' && otherColourName === null) {
    issue(issues, 'invariant', '$.intent.pergola.frame.otherColourName', 'An other finish requires a colour name.');
  }
  if (frameFinish !== 'other' && otherColourName !== null) {
    issue(issues, 'invariant', '$.intent.pergola.frame.otherColourName', 'Standard finishes cannot carry an other colour name.');
  }

  const roof = parseRoof(pergola.roof, '$.intent.pergola.roof', issues);
  const edgeTreatmentsRaw = pergola.edgeTreatments;
  if (!Array.isArray(edgeTreatmentsRaw)) {
    issue(issues, 'invalid_type', '$.intent.pergola.edgeTreatments', 'Expected an array.');
  }
  const edgeTreatments = Array.isArray(edgeTreatmentsRaw)
    ? edgeTreatmentsRaw.map((edge, index) => parseEdgeTreatment(edge, index, issues))
    : [];
  if (edgeTreatments.length !== CUSTOMER_EDGE_IDS.length) {
    issue(issues, 'invariant', '$.intent.pergola.edgeTreatments', 'Exactly one treatment is required for each edge.');
  }
  const uniqueEdges = new Set(edgeTreatments.map((edge) => edge.edgeId));
  if (uniqueEdges.size !== edgeTreatments.length || CUSTOMER_EDGE_IDS.some((edge) => !uniqueEdges.has(edge))) {
    issue(issues, 'invariant', '$.intent.pergola.edgeTreatments', 'Edge IDs must be unique and complete.');
  }
  if (
    placementMode === 'attached'
    && edgeTreatments.find((edge) => edge.edgeId === attachmentSide)?.treatment.kind !== 'none'
  ) {
    issue(issues, 'invariant', '$.intent.pergola.edgeTreatments', 'The attached house edge cannot carry a customer edge treatment.');
  }

  const lighting = readRecord(
    pergola.lighting,
    '$.intent.pergola.lighting',
    ['downlights', 'dimmerRequested', 'ledStripInterest'],
    issues,
  );
  const downlights = readEnum<CustomerDownlightIntentV1>(
    lighting.downlights,
    ['none', 'subtle', 'standard', 'bright'],
    '$.intent.pergola.lighting.downlights',
    issues,
  );
  const dimmerRequested = readBoolean(
    lighting.dimmerRequested,
    '$.intent.pergola.lighting.dimmerRequested',
    issues,
  );
  const ledStripInterest = readBoolean(
    lighting.ledStripInterest,
    '$.intent.pergola.lighting.ledStripInterest',
    issues,
  );
  if (downlights === 'none' && dimmerRequested) {
    issue(issues, 'invariant', '$.intent.pergola.lighting.dimmerRequested', 'A dimmer requires downlight intent.');
  }
  const heatingInterest = readEnum<CustomerHeatingInterestV1>(
    pergola.heatingInterest,
    ['none', 'interested'],
    '$.intent.pergola.heatingInterest',
    issues,
  );

  const site = readRecord(intent.site, '$.intent.site', ['level', 'house'], issues);
  const level = readEnum<CustomerSiteLevelV1>(
    site.level,
    ['ground', 'deck', 'elevated', 'unsure'],
    '$.intent.site.level',
    issues,
  );
  const house = readRecord(
    site.house,
    '$.intent.site.house',
    ['present', 'footprint', 'storeys', 'roofForm'],
    issues,
  );
  const housePresent = readBoolean(house.present, '$.intent.site.house.present', issues);
  const footprint = readEnum<CustomerHouseFootprintV1>(
    house.footprint,
    ['straight', 'l_left', 'l_right', 'recess_left', 'recess_right'],
    '$.intent.site.house.footprint',
    issues,
  );
  const storeys = readEnum<CustomerHouseStoreysV1>(
    house.storeys,
    ['one', 'two', 'unsure'],
    '$.intent.site.house.storeys',
    issues,
  );
  const roofForm = readEnum<CustomerHouseRoofFormV1>(
    house.roofForm,
    ['hipped', 'gable', 'mono', 'flat', 'unsure'],
    '$.intent.site.house.roofForm',
    issues,
  );

  if (issues.length > 0) return { success: false, issues };
  return {
    success: true,
    data: {
      schemaVersion,
      configurationId,
      revision,
      createdAt,
      updatedAt,
      source: {
        kind: sourceKind,
        sourcePath,
        sourceSlug,
      },
      intent: {
        pergola: {
          id: pergolaId,
          family,
          dimensions: { lengthMm, projectionMm, clearHeightMm },
          placement: {
            mode: placementMode,
            attachmentSide,
            connectionIntent,
          },
          frame: {
            finish: frameFinish,
            otherColourName,
          },
          roof,
          edgeTreatments,
          lighting: {
            downlights,
            dimmerRequested,
            ledStripInterest,
          },
          heatingInterest,
        },
        site: {
          level,
          house: {
            present: housePresent,
            footprint,
            storeys,
            roofForm,
          },
        },
      },
    },
  };
}

export function parseCustomerPergolaConfigurationV1(
  value: unknown,
): CustomerPergolaConfigurationV1 {
  const result = safeParseCustomerPergolaConfigurationV1(value);
  if (!result.success) throw new CustomerConfigurationParseError(result.issues);
  return result.data;
}
