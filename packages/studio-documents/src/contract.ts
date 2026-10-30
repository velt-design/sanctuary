import type {
  Assembly3D,
  GeometryPlanViewModel,
  ViewerSceneModel,
  RoofFinishGeometry,
  Point3,
  HouseModel3D,
  LightSite,
  StripSite,
  BlindOpening,
} from '@sp/geometry';

export const STUDIO_DOCUMENT_RENDERER_VERSION = 'studio-booklet.v1' as const;
export const STUDIO_DOCUMENT_LAYOUT_VERSION =
  'studio-booklet-layout.v4' as const;
/** Frozen approved drawing inventory with its historical opening sheet. */
export const STUDIO_DOCUMENT_COVER_LAYOUT_VERSION =
  'studio-booklet-layout.v3' as const;
export const STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION =
  'studio-booklet-layout.v2' as const;
export const STUDIO_DOCUMENT_SOURCE_SCHEMA =
  'studio_client_document.v1' as const;
export type StudioDocumentMesh = {
  id: string;
  kind: 'frame' | 'timber' | 'fabric' | 'acrylic' | 'light' | 'context';
  positions: number[];
  indices: number[];
};
export type StudioDocumentProduct = {
  id: string;
  label: string;
  code: string;
  pose: { x: number; y: number; rotation: number };
  widthMm: number;
  projectionMm: number;
  roofLabel: string;
  roofMaterial: string;
  frameFinish: 'Black' | 'White';
  selectedDetails: string[];
  extras: { infills: string[]; blinds: string[]; lights: string[] };
  assembly: Assembly3D;
  plan: GeometryPlanViewModel;
  viewerScene: ViewerSceneModel;
  covering?: RoofFinishGeometry;
  accessories: StudioDocumentMesh[];
  /** Canonical selected facts frozen for the v3 job-specific drawing sheets. */
  drawingDetails?: {
    lights: { rafters: LightSite[]; cedar: LightSite[]; strips: StripSite[] };
    blinds: {
      opening: BlindOpening;
      lowered: number;
      description: string;
      cover?: 'NONE' | 'FLASHING' | 'PELMET';
    }[];
    finish: {
      material: string;
      profile?: string;
      ceiling?: string;
      trayWidth?: number;
    };
  };
};
/** Own immutable drawing input. There is deliberately no costing configuration,
 * private client record, invented site survey, or mutable document URL here. */
export type StudioClientDocumentSource = {
  schemaVersion: typeof STUDIO_DOCUMENT_SOURCE_SCHEMA;
  rendererVersion: typeof STUDIO_DOCUMENT_RENDERER_VERSION;
  /** Frozen layout selector. Absence preserves original pages/checkpoints. */
  layoutVersion?:
    | typeof STUDIO_DOCUMENT_LAYOUT_VERSION
    | typeof STUDIO_DOCUMENT_COVER_LAYOUT_VERSION
    | typeof STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION;
  pageManifest?: StudioDocumentPage[];
  snapshotId: string;
  contentHash: string;
  designId: string;
  revision: number;
  /** Saved commercial design label, independent of the internal authored save counter. */
  designVersionLabel: string;
  projectName: string;
  siteAddress: string;
  issuedDate: string;
  issuedAt: string;
  products: StudioDocumentProduct[];
  houses: {
    id: string;
    label: string;
    footprint: Point3[];
    roof: Point3[][];
    walls: Point3[][];
    model: HouseModel3D;
    appearance: unknown;
    pose: { xMm: string; yMm: string; rotationDeg: string };
  }[];
  joins: {
    id: string;
    objectIds: string[];
    label: string;
    polygons: Point3[][];
  }[];
};
export type StudioDocumentPage = {
  index: number;
  key: string;
  kind:
    | 'cover'
    | 'plan'
    | 'iso'
    | 'elevation'
    | 'lighting'
    | 'blind-plan'
    | 'blind-elevation';
  objectId?: string;
  label: string;
  code: string;
};
export function parseStudioClientDocumentSource(
  value: unknown,
): StudioClientDocumentSource {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) =>
    typeof v === 'string' && v.length > 0 && v.length <= 200;
  if (
    !object(value) ||
    value.schemaVersion !== STUDIO_DOCUMENT_SOURCE_SCHEMA ||
    value.rendererVersion !== STUDIO_DOCUMENT_RENDERER_VERSION ||
    (Object.hasOwn(value, 'layoutVersion') &&
      ![
        STUDIO_DOCUMENT_LAYOUT_VERSION,
        STUDIO_DOCUMENT_COVER_LAYOUT_VERSION,
        STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION,
      ].includes(
        value.layoutVersion as typeof STUDIO_DOCUMENT_LAYOUT_VERSION,
      )) ||
    typeof value.designVersionLabel !== 'string' ||
    !/^V[1-9][0-9]*(?:\.[0-9]+)?$/.test(value.designVersionLabel) ||
    value.designVersionLabel.length > 32 ||
    !id(value.snapshotId) ||
    !id(value.contentHash) ||
    !id(value.designId) ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 1 ||
    typeof value.projectName !== 'string' ||
    value.projectName.length > 280 ||
    typeof value.siteAddress !== 'string' ||
    value.siteAddress.length > 280 ||
    typeof value.issuedDate !== 'string' ||
    value.issuedDate.length > 64 ||
    typeof value.issuedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.issuedAt)) ||
    !Array.isArray(value.products) ||
    value.products.length > 32 ||
    !Array.isArray(value.houses) ||
    value.houses.length > 16 ||
    !Array.isArray(value.joins) ||
    value.joins.length > 64 ||
    value.products.some(
      (p) =>
        !object(p) ||
        !id(p.id) ||
        !id(p.label) ||
        !object(p.pose) ||
        ![p.pose.x, p.pose.y, p.pose.rotation, p.widthMm, p.projectionMm].every(
          (v) => typeof v === 'number' && Number.isFinite(v),
        ) ||
        !object(p.assembly) ||
        !Array.isArray(p.assembly.members) ||
        p.assembly.members.length > 5000 ||
        !Array.isArray(p.assembly.roofPlanes) ||
        !object(p.plan) ||
        !object(p.viewerScene) ||
        !Array.isArray(p.viewerScene.layers) ||
        !Array.isArray(p.accessories) ||
        !Array.isArray(p.selectedDetails) ||
        !object(p.extras) ||
        ![p.extras.infills, p.extras.blinds, p.extras.lights].every(
          (a) =>
            Array.isArray(a) &&
            a.every((t) => typeof t === 'string' && t.length <= 2000),
        ),
    )
  )
    throw Error('Frozen document geometry is unavailable');
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
    16 * 1024 * 1024
  )
    throw Error('Frozen document exceeds the supported size');
  const source = structuredClone(
    value,
  ) as unknown as StudioClientDocumentSource;
  if (isApprovedStudioDocumentLayout(source.layoutVersion)) {
    const point = (v: unknown): v is Point3 =>
      object(v) &&
      [v.x, v.y, v.z].every((n) => typeof n === 'number' && Number.isFinite(n));
    for (const product of source.products) {
      const details = product.drawingDetails;
      if (
        !details ||
        !object(details.finish) ||
        !object(details.lights) ||
        !Array.isArray(details.blinds) ||
        details.blinds.length > 32 ||
        !['acrylic', 'solid', 'combination'].includes(
          details.finish.material,
        ) ||
        (details.finish.profile !== undefined &&
          !['corrugated', 'trapezoidal', 'tray'].includes(
            details.finish.profile,
          )) ||
        (details.finish.ceiling !== undefined &&
          ![
            'cedar-100',
            'cedar-150',
            'thermopine-100',
            'thermopine-150',
          ].includes(details.finish.ceiling)) ||
        (details.finish.trayWidth !== undefined &&
          ![300, 400, 500].includes(details.finish.trayWidth)) ||
        !['rafters', 'cedar', 'strips'].every((k) =>
          Array.isArray(details.lights[k as keyof typeof details.lights]),
        ) ||
        details.lights.rafters.length > 200 ||
        details.lights.cedar.length > 200 ||
        details.lights.strips.length > 150 ||
        [...details.lights.rafters, ...details.lights.cedar].some(
          (s) =>
            !id(s.id) ||
            !point(s.point) ||
            !point(s.normal) ||
            !Number.isFinite(s.diameter) ||
            s.diameter <= 0,
        ) ||
        details.lights.strips.some(
          (s) =>
            !id(s.id) || !point(s.start) || !point(s.end) || !point(s.normal),
        ) ||
        details.blinds.some(
          (b) =>
            !object(b.opening) ||
            !id(b.opening.id) ||
            !['front', 'left', 'right', 'rear'].includes(b.opening.side) ||
            !point(b.opening.start) ||
            !point(b.opening.end) ||
            !Number.isFinite(b.opening.width) ||
            b.opening.width <= 0 ||
            !Number.isFinite(b.opening.top) ||
            !Number.isFinite(b.lowered) ||
            b.lowered < 0 ||
            b.lowered > 100 ||
            typeof b.description !== 'string' ||
            b.description.length > 2000 ||
            (Object.hasOwn(b, 'cover') && !['NONE', 'FLASHING', 'PELMET'].includes(b.cover as string)),
        )
      )
        throw Error('Frozen selected drawing facts are unavailable');
    }
    const expected = approvedStudioDocumentPages(source);
    if (
      !Array.isArray(source.pageManifest) ||
      source.pageManifest.length !== expected.length ||
      source.pageManifest.some((page, index) => {
        const wanted = expected[index];
        return (
          !object(page) ||
          Object.keys(page).length !== Object.keys(wanted).length ||
          Object.entries(wanted).some(
            ([key, value]) => page[key as keyof StudioDocumentPage] !== value,
          )
        );
      })
    )
      throw Error('Frozen drawing inventory is unavailable');
  } else if (Object.hasOwn(source, 'pageManifest'))
    throw Error('Unexpected frozen drawing inventory');
  return source;
}
export function studioDocumentPages(
  source: Pick<
    StudioClientDocumentSource,
    'products' | 'layoutVersion' | 'pageManifest'
  >,
): StudioDocumentPage[] {
  if (isApprovedStudioDocumentLayout(source.layoutVersion)) {
    if (!source.pageManifest)
      throw Error('Frozen drawing inventory is unavailable');
    return structuredClone(source.pageManifest);
  }
  return [
    {
      index: 0,
      key: 'cover',
      kind: 'cover',
      label: 'Design overview and drawing register',
      code: 'A00',
    },
    ...source.products.flatMap((p, i) => [
      {
        index: 2 * i + 1,
        key: `${p.id}:plan`,
        kind: 'plan' as const,
        objectId: p.id,
        label: `${p.label} - Roof plan`,
        code: `A${String(2 * i + 1).padStart(2, '0')}`,
      },
      {
        index: 2 * i + 2,
        key: `${p.id}:iso`,
        kind: 'iso' as const,
        objectId: p.id,
        label: `${p.label} - Isometric`,
        code: `A${String(2 * i + 2).padStart(2, '0')}`,
      },
    ]),
  ];
}

/** This manifest is frozen before hashing, not inferred from later UI state. */
export function approvedStudioDocumentPages(
  source: Pick<StudioClientDocumentSource, 'products' | 'layoutVersion'>,
): StudioDocumentPage[] {
  const withoutCover = source.layoutVersion === STUDIO_DOCUMENT_LAYOUT_VERSION;
  const pages: StudioDocumentPage[] = withoutCover ? [] : [
    {
      index: 0,
      key: 'cover',
      kind: 'cover',
      label: 'Design overview and drawing register',
      code: 'A00',
    },
  ];
  for (const p of source.products) {
    const add = (kind: StudioDocumentPage['kind'], label: string) => {
      const index = pages.length;
      pages.push({
        index,
        key: `${p.id}:${kind}`,
        kind,
        objectId: p.id,
        label: `${p.label} - ${label}`,
        code: `A${String(index + (withoutCover ? 1 : 0)).padStart(2, '0')}`,
      });
    };
    add('plan', 'Roof plan');
    add('iso', 'Isometric');
    add(
      'elevation',
      p.assembly.family === 'gable' ? 'Gable end elevation' : 'Side elevation',
    );
    const details = p.drawingDetails;
    if (!details) throw Error('Frozen selected drawing facts are unavailable');
    if (
      details.lights.rafters.length +
      details.lights.cedar.length +
      details.lights.strips.length
    )
      add(
        'lighting',
        details.finish.material === 'acrylic'
          ? 'Reflected lighting plan'
          : 'Reflected ceiling lighting plan',
      );
    if (details.blinds.length) {
      add('blind-plan', 'Blind location plan');
      add('blind-elevation', 'Blind elevations');
    }
  }
  return pages;
}
export function isApprovedStudioDocumentLayout(
  version: unknown,
): version is typeof STUDIO_DOCUMENT_LAYOUT_VERSION | typeof STUDIO_DOCUMENT_COVER_LAYOUT_VERSION {
  return version === STUDIO_DOCUMENT_LAYOUT_VERSION || version === STUDIO_DOCUMENT_COVER_LAYOUT_VERSION;
}
export function studioDocumentLayoutVersion(
  source: StudioClientDocumentSource,
): 'legacy' | NonNullable<StudioClientDocumentSource['layoutVersion']> {
  if (!Object.hasOwn(source, 'layoutVersion')) return 'legacy';
  if (
    source.layoutVersion !== STUDIO_DOCUMENT_LAYOUT_VERSION &&
    source.layoutVersion !== STUDIO_DOCUMENT_COVER_LAYOUT_VERSION &&
    source.layoutVersion !== STUDIO_DOCUMENT_PREVIOUS_LAYOUT_VERSION
  )
    throw Error('The frozen booklet presentation is unavailable');
  return source.layoutVersion;
}
