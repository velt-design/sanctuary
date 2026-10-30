import {
  demoContact,
  fitDemoContactVariants,
  validateDemoContactArtifacts,
} from "./demoHouseClearance";
import {
  prepareDemoClearanceHouse,
  evaluateDemoClearance,
  type DemoClearanceHouse,
} from "./demoContactClearance";
import {
  websiteSoffitTarget,
  boxedHouseSoffits,
} from "./studioHouseWebsiteContact";
import {
  previewSupportDatum,
  solvePergolaPreview,
} from "@sp/configurator/geometry";
import {
  resolveStudioWebsiteDesign,
  type StudioWebsiteDesign,
} from "./websiteDesign";
import { websiteConnectionEdge } from "./websiteConnectionEdge";
import {
  websiteProductPhysical,
  type WebsitePhysicalProduct,
} from "./websiteProductPhysical";
import { studioWebsiteBracketsFromSurface } from "./studioHouseWebsiteBrackets";
import type {
  StudioHouseScene,
  StudioHouseAttachment,
  HouseReference,
} from "./studioHouseScene";
import { studioHouseTargets, solveStudioHouse } from "./studioHouseGeometry";
import type { StudioConnectionMeasurements } from "./studioConnectionDiagnostics";
import { StudioContactFitError } from "./studioConnectionDiagnostics";
import { CUSTOMER_DIMENSION_BOUNDS } from '@sp/configurator/core';
import type { Point3 } from "@sp/geometry";
import {readStudioFacadeClearance} from './studioFacadeClearance';
import {measureStudioFacadeClearance} from './studioFacadeClearanceGeometry';

type Design = Extract<
  ReturnType<typeof resolveStudioWebsiteDesign>,
  { ok: true }
>["value"];
export type StudioContactVariant = {
  datum: number;
  physical: WebsitePhysicalProduct;
  edge: ReturnType<typeof websiteConnectionEdge>;
};
export class StudioContactVariantMissing extends Error {
  constructor(readonly datum: number) {
    super("Preparing the exact physical connection.");
  }
}
export type StudioAttachmentArtifacts = {
  facadeClearanceMm?: number;
  target: ReturnType<typeof studioHouseTargets>[number];
  edge: ReturnType<typeof websiteConnectionEdge>;
  demo: {
    surface: ReturnType<typeof demoContact>["surface"];
    clearance: DemoClearanceHouse;
  } | null;
  soffit: Point3[] | null;
  design: Design;
};
/** Construct actual house/contact artifacts once. No hypothetical authored edit. */
export function prepareStudioAttachmentArtifacts(
  scene: StudioHouseScene,
  binding: StudioHouseAttachment,
  value: StudioWebsiteDesign,
): StudioAttachmentArtifacts {
  const h = scene.houses.find((h) => h.id === binding.houseId);
  if (!h)
    throw Error(
      "The attached house is missing. Change the connection or detach using the retained reference.",
    );
  let target =
    binding.method === "soffit"
      ? websiteSoffitTarget(h, binding.edge)
      : studioHouseTargets(h, binding.method).find(
          (t) => t.side === binding.edge && t.kind === binding.kind,
        );
  if (!target || target.error)
    throw Error(
      target?.error ??
        "The selected house edge is unavailable. Change the connection.",
    );
  const resolved = resolveStudioWebsiteDesign(value, value.objectId);
  if (!resolved.ok) throw Error(resolved.message);
  const design = resolved.value;
  if (
    design.roof.attachmentIntent === "freestanding" ||
    design.input.connection !== binding.method
  )
    throw Error(
      "The pergola connection and house relationship disagree. Change the connection or detach.",
    );
  const assembly = solvePergolaPreview(design.input, design.roof).geometry
    ?.assembly;
  if (!assembly)
    throw Error("This pergola cannot use the selected connection.");
  const demo =
    binding.contactBasis === "canonical-house.v1"
      ? demoContact(h, binding.edge, design, target)
      : null;
  if (demo) target = demo.target;
  const edge =
    demo?.edge ??
    websiteConnectionEdge(
      assembly,
      binding.method === "soffit" ? "top" : "underside",
    );
  const soffit =
    binding.method === "soffit"
      ? boxedHouseSoffits(solveStudioHouse(h)).find(
          (s) => s.side === binding.edge,
        )?.world
      : null;
  return {
    ...(binding.method==='facade'&&value.facadeClearanceMm!==undefined?{facadeClearanceMm:readStudioFacadeClearance(value.facadeClearanceMm)}:{}),
    target,
    edge,
    design,
    demo: demo
      ? {
          surface: demo.surface,
          clearance: prepareDemoClearanceHouse(h, binding.edge),
        }
      : null,
    soffit: soffit ?? null,
  };
}
export function prepareStudioContactVariant(
  design: Design,
  datum: number,
): StudioContactVariant {
  const geometry = solvePergolaPreview(design.input, design.roof, {
    supportDatumMm: datum,
  }).geometry;
  if (!geometry) throw Error("The connected product cannot be resolved.");
  return {
    datum,
    edge: websiteConnectionEdge(geometry.assembly),
    physical: websiteProductPhysical(
      { design, error: null, geometryOptions: { supportDatumMm: datum } },
      true,
    ),
  };
}
export function evaluateStudioAttachment(
  binding: StudioHouseAttachment,
  artifacts: StudioAttachmentArtifacts,
  variant: (datum: number) => StudioContactVariant,
  layoutOnly = false,
) {
  let measurements: StudioConnectionMeasurements | null = null;
  const fail = (error: string) => ({
    error,
    measurements,
    position: null as HouseReference["position"] | null,
    geometryOptions: undefined as { supportDatumMm: number } | undefined,
    attachmentHeightMm: null as number | null,
    target: null as ReturnType<typeof studioHouseTargets>[number] | null,
    reference: binding.reference,
  });
  try {
    let target = artifacts.target;
    const { edge, design: d, demo } = artifacts,
      length = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
    let { start, end } = target;
    measurements = {
      targetAttachmentHeightMm: target.heightMm,
      availableSpanMm: Math.hypot(end.x - start.x, end.y - start.y),
      requiredSpanMm: length,
      authoredWidthMm: d.input.widthMm,
      alongEdgeMm: binding.alongEdgeMm ?? 0,
      target: {
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
      },
    };
    if (Math.hypot(end.x - start.x, end.y - start.y) + 1e-6 < length)
      return fail(
        "The house edge is shorter than this pergola. Choose another edge or resize the house.",
      );
    const dx = end.x - start.x,
      dy = end.y - start.y;
    if (
      -dy * (target.centre.x - (start.x + end.x) / 2) +
        dx * (target.centre.y - (start.y + end.y) / 2) >
      0
    )
      [start, end] = [end, start];
    const a =
        Math.atan2(end.y - start.y, end.x - start.x) -
        Math.atan2(edge.end.y - edge.start.y, edge.end.x - edge.start.x),
      c = Math.cos(a),
      s = Math.sin(a);
    const supportedDatum = (datum: number) => {
      if (measurements) measurements.supportDatumMm = datum;
      try {
        return previewSupportDatum({ supportDatumMm: datum });
      } catch {
        throw new StudioContactFitError(
          `This ${binding.method === "facade" ? "wall" : "roof edge"} places the pergola support at ${Math.round(datum)} mm. The current product supports 2000–5000 mm. Check the actual house height or choose another connection.`,
          { kind: 'support-range', supportDatumMm: datum, minimumMm: CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.minimum, maximumMm: CUSTOMER_DIMENSION_BOUNDS.clearHeightMm.maximum },
        );
      }
    };
    let supportDatumMm = supportedDatum(2400 + target.heightMm - edge.start.z);
    const targetLength = Math.hypot(end.x - start.x, end.y - start.y),
      along = binding.alongEdgeMm ?? 0;
    if (
      !Number.isFinite(along) ||
      along < 0 ||
      along > targetLength - length + 1e-6 ||
      (along !== 0 && binding.contactBasis !== "canonical-house.v1")
    )
      return fail("This placement extends beyond the selected house edge.");
    const position = {
      x:
        start.x -
        edge.start.x * c +
        edge.start.y * s +
        ((end.x - start.x) / targetLength) * along,
      y:
        start.y -
        edge.start.x * s -
        edge.start.y * c +
        ((end.y - start.y) / targetLength) * along,
      rotation: (a * 180) / Math.PI,
    };
    if (demo && !layoutOnly) {
      const fitted = supportedDatum(
        fitDemoContactVariants(
          d.input.connection,
          (datum) =>
            evaluateDemoClearance(
              demo.clearance,
              variant(datum).physical,
              position,
            ),
          supportDatumMm,
        ),
      );
      const delta = fitted - supportDatumMm;
      supportDatumMm = fitted;
      target = {
        ...target,
        heightMm: target.heightMm + delta,
        start: { ...target.start, z: target.start.z + delta },
        end: { ...target.end, z: target.end.z + delta },
      };
      if (binding.method==='facade') {
        const requested=artifacts.facadeClearanceMm;
        let gap:number|undefined;
        try {gap=measureStudioFacadeClearance(demo.surface.facadeClearance,variant(supportDatumMm).physical,position).gapMm;}
        catch(error){if(requested!==undefined)throw error;}
        if(requested!==undefined){
          if(gap===undefined)throw Error('The actual roof clearance is unavailable.');
          const before=supportDatumMm;
          for(let attempt=0;attempt<3&&gap<requested-1e-4;attempt++){
            supportDatumMm=supportedDatum(Math.floor(supportDatumMm-(requested-gap)));
            gap=measureStudioFacadeClearance(demo.surface.facadeClearance,variant(supportDatumMm).physical,position).gapMm;
          }
          if(gap<requested-1e-4)return fail('The requested roof clearance cannot be resolved. Your house dimensions are unchanged.');
          const drop=supportDatumMm-before;
          target={...target,heightMm:target.heightMm+drop,start:{...target.start,z:target.start.z+drop},end:{...target.end,z:target.end.z+drop}};
        }
        if(measurements&&gap!==undefined){measurements.roofClearanceMm=gap;if(requested!==undefined)measurements.requestedRoofClearanceMm=requested;}
      }
      const actual = variant(supportDatumMm);
      validateDemoContactArtifacts(
        demo.surface,
        d.input.connection,
        actual.physical.points,
        actual.edge.start.z,
        position,
        target,
        () =>
          evaluateDemoClearance(demo.clearance, actual.physical, position)
            .gapMm,
      );
    }
    if (binding.method === "soffit" && !layoutOnly) {
      if (!artifacts.soffit)
        return fail("No level boxed soffit surface supports this detail.");
      studioWebsiteBracketsFromSurface(
        artifacts.soffit,
        variant(supportDatumMm).edge,
        position,
        d.input.widthMm,
      );
    }
    return {
      error: null,
      measurements,
      position,
      geometryOptions: { supportDatumMm },
      attachmentHeightMm: target.heightMm,
      target,
      reference: binding.reference,
    };
  } catch (e) {
    if (e instanceof StudioContactVariantMissing) throw e;
    if (e instanceof StudioContactFitError && measurements) measurements.fitConstraint = e.constraint;
    return fail(
      e instanceof Error ? e.message : "The house connection is unavailable.",
    );
  }
}
/** Canonical command path and prepared evaluation share the exact fit and refusals. */
export function resolveStudioAttachment(
  scene: StudioHouseScene,
  binding: StudioHouseAttachment,
  value: StudioWebsiteDesign,
) {
  try {
    const artifacts = prepareStudioAttachmentArtifacts(scene, binding, value),
      variants = new Map<number, StudioContactVariant>();
    return evaluateStudioAttachment(binding, artifacts, (datum) => {
      let v = variants.get(datum);
      if (!v) {
        v = prepareStudioContactVariant(artifacts.design, datum);
        variants.set(datum, v);
      }
      return v;
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The house connection is unavailable.",
      measurements: null,
      position: null,
      geometryOptions: undefined,
      attachmentHeightMm: null,
      target: null,
      reference: binding.reference,
    };
  }
}
