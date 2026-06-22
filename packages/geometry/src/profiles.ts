import type { AssemblyMemberProfile, Point2 } from './contracts';
import { GENERATED_PROFILE_ASSETS } from './generated/profileAssets';
import { parseFiniteNumber } from './units';

type AssemblyMemberProfileAnchors = NonNullable<AssemblyMemberProfile['anchors']>;

function defaultProfileAnchors(widthMm: number, depthMm: number): AssemblyMemberProfileAnchors {
  return {
    undersideZ: -depthMm / 2,
    topsideZ: depthMm / 2,
    backFaceY: -widthMm / 2,
    frontFaceY: widthMm / 2,
    roofBearingFaceY: widthMm / 2,
    roofBearingFaceZ: depthMm / 2,
  };
}

function clonePolygon(points: Point2[] | null | undefined): Point2[] | null {
  if (!points) return null;
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function cloneSectionVoids(voids: Point2[][] | null | undefined): Point2[][] | null {
  return voids?.map((voidBoundary) => clonePolygon(voidBoundary) ?? []) ?? null;
}

function cloneProfile(profile: AssemblyMemberProfile): AssemblyMemberProfile {
  return {
    ...profile,
    sectionOutline: clonePolygon(profile.sectionOutline),
    sectionVoids: cloneSectionVoids(profile.sectionVoids),
    anchors: profile.anchors ? { ...profile.anchors } : null,
  };
}

function rectangularProfile(
  widthMm: number,
  depthMm: number,
  options: {
    profileKey?: string | null;
  } = {},
): AssemblyMemberProfile {
  return {
    shape: 'rectangular',
    widthMm,
    depthMm,
    profileKey: options.profileKey ?? null,
    sectionOutline: null,
    sectionVoids: null,
    anchors: defaultProfileAnchors(widthMm, depthMm),
  };
}

const SP_GUTTER_ASSET = GENERATED_PROFILE_ASSETS.sp_gutter;
const SP_GUTTER_INSTALL_ANCHORS: AssemblyMemberProfileAnchors = {
  undersideZ: -75.284312,
  topsideZ: 75.284312,
  backFaceY: -50,
  frontFaceY: 50,
  // The tall plain wall is the roof/house side and its inner top lip is the roof bearing line.
  roofBearingFaceY: -24.003203,
  roofBearingFaceZ: 73.009886,
};

const SP_GUTTER_PROFILE: AssemblyMemberProfile = {
  profileKey: 'sp_gutter',
  shape: 'custom',
  widthMm: SP_GUTTER_ASSET.widthMm,
  depthMm: SP_GUTTER_ASSET.depthMm,
  sectionOutline: clonePolygon(SP_GUTTER_ASSET.sectionOutline),
  sectionVoids: cloneSectionVoids(SP_GUTTER_ASSET.sectionVoids),
  anchors: SP_GUTTER_INSTALL_ANCHORS,
};

const SP_JOINERS_ASSET = GENERATED_PROFILE_ASSETS.sp_joiners;
const SP_JOINERS_PROFILE: AssemblyMemberProfile = {
  profileKey: 'sp_joiners',
  shape: 'custom',
  widthMm: SP_JOINERS_ASSET.widthMm,
  depthMm: SP_JOINERS_ASSET.depthMm,
  sectionOutline: clonePolygon(SP_JOINERS_ASSET.sectionOutline),
  sectionVoids: cloneSectionVoids(SP_JOINERS_ASSET.sectionVoids),
  anchors: defaultProfileAnchors(SP_JOINERS_ASSET.widthMm, SP_JOINERS_ASSET.depthMm),
};

const BOX_GUTTER_100X100_PROFILE = rectangularProfile(100, 100, {
  profileKey: 'box_gutter_100x100',
});

const RHS_150X50X3_PROFILE = rectangularProfile(50, 150, {
  profileKey: 'rhs_150x50x3',
});

export function resolveAssemblyMemberProfileAnchors(profile: AssemblyMemberProfile): AssemblyMemberProfileAnchors {
  return profile.anchors ?? defaultProfileAnchors(profile.widthMm, profile.depthMm);
}

export function parseAssemblyMemberProfile(value: string | null | undefined): AssemblyMemberProfile | null {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text.toLowerCase();
  if (normalized.includes('sp gutter') || normalized === 'sp_gutter') {
    return cloneProfile(SP_GUTTER_PROFILE);
  }
  if (
    normalized.includes('sp joiners') ||
    normalized.includes('sp joiner') ||
    normalized.includes('sp_joiners') ||
    normalized.includes('sp_joiner') ||
    normalized.includes('sp-joiners') ||
    normalized.includes('sp-joiner')
  ) {
    return cloneProfile(SP_JOINERS_PROFILE);
  }
  if (normalized.includes('rhs 150x50x3') || normalized.includes('steel rhs 150x50x3')) {
    return cloneProfile(RHS_150X50X3_PROFILE);
  }
  if (normalized.includes('box_gutter_100x100') || normalized.includes('box gutter 100x100')) {
    return cloneProfile(BOX_GUTTER_100X100_PROFILE);
  }

  const profileMatch = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (profileMatch) {
    const a = parseFiniteNumber(profileMatch[1]);
    const b = parseFiniteNumber(profileMatch[2]);
    if (a !== null && b !== null && a > 0 && b > 0) {
      const widthMm = Math.round(Math.min(a, b));
      const depthMm = Math.round(Math.max(a, b));
      return rectangularProfile(widthMm, depthMm);
    }
  }

  return null;
}
