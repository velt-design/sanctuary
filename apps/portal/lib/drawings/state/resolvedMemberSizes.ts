/*
 * PR-T6 (2026-05-26) — derive a display-label map of system-resolved
 * member sizes from a solved `Assembly3D`. Consumed by the right
 * inspector's MEMBER SIZES section so the dropdown for each override
 * field can show the resolved size in muted text when the user hasn't
 * picked an explicit override.
 *
 * Mapping: each override-field key (rafterProfile, postProfile, ...)
 * resolves to a representative `Assembly3D.members[*]` entry by role
 * + id discriminator. Profile keys come straight from the solver's
 * chosen profile (e.g. `100x50`, `SP Gutter`, etc.) so the display
 * label matches what the dropdown options already use.
 *
 * Missing entries (e.g. no ridge beam in a mono pergola) are simply
 * omitted from the returned map; the consumer falls back to "Auto" in
 * the dropdown for those.
 */

import type { Assembly3D, AssemblyMember3D, AssemblyMemberProfile } from '@sp/geometry';
import type { MemberOverrideKey } from '@/components/drawings/rail/SanctuaryWorkbenchRail';

/**
 * PR-T6 (2026-05-26): exported sentinel that tells the inspector
 * "this member slot is expected for some pergola families but the
 * current geometry doesn't include one." The rail renders the
 * dropdown's auto option as "Not used" when it sees this value
 * (still muted), distinguishing "system default" from "no member to
 * default to in the first place". Today this covers ridge / tie /
 * strut on mono + box geometry; tomorrow it'll cover any new family
 * that adds / drops member slots.
 */
export const MEMBER_SIZE_NOT_USED = 'not-used' as const;

export type ResolvedMemberSizeValue = string | typeof MEMBER_SIZE_NOT_USED;

export type ResolvedMemberSizeMap = Partial<Record<MemberOverrideKey, ResolvedMemberSizeValue>>;

/**
 * Format a profile for display. Prefers an explicit `profileKey` (which
 * matches the dropdown option labels like "100x50", "sp_gutter") so the
 * rendered "Auto" label looks identical to what the user would see after
 * picking that profile manually. Falls back to `widthxdepth` derived
 * from the profile's millimetre dimensions when no key is set — common
 * for posts and ledgers in the mono/box solver, which initialise the
 * profile inline without naming it.
 */
function formatProfileLabel(profile: AssemblyMemberProfile | null | undefined): string | null {
  if (!profile) return null;
  if (typeof profile.profileKey === 'string' && profile.profileKey.length > 0) {
    return profile.profileKey;
  }
  // Codebase convention puts the major axis first ("100x50" = depth 100,
  // width 50 — matches RAFTER_PROFILE_OPTIONS etc.). The contracts call
  // `depthMm` the major section axis, `widthMm` the minor, so output
  // depth × width.
  if (Number.isFinite(profile.depthMm) && Number.isFinite(profile.widthMm)) {
    return `${Math.round(profile.depthMm)}x${Math.round(profile.widthMm)}`;
  }
  return null;
}

/*
 * Pre-condition: the caller MUST pass a fully-solved assembly. The map
 * relies on "member of role X is absent" to mean "this geometry doesn't
 * use that member type", which only holds once the solver has finished.
 * The right inspector mounts after `geometryArtifact` resolves, so this
 * holds at every real call site today. If the function ever gets used
 * mid-solve in the future, partial assemblies will misclassify in-flight
 * members as 'not-used'.
 */
export function buildResolvedMemberSizeMap(
  assembly: Assembly3D | null | undefined,
): ResolvedMemberSizeMap {
  if (!assembly) return {};
  const map: ResolvedMemberSizeMap = {};
  const members = assembly.members ?? [];

  const firstByRole = (role: string): string | null => {
    const member: AssemblyMember3D | undefined = members.find((m) => m.role === role);
    return formatProfileLabel(member?.profile);
  };
  const findById = (id: string): string | null => {
    const member: AssemblyMember3D | undefined = members.find((m) => m.id === id);
    return formatProfileLabel(member?.profile);
  };
  const resolveOrNotUsed = (size: string | null): ResolvedMemberSizeValue =>
    size ?? MEMBER_SIZE_NOT_USED;

  // Always-present slots — if these are missing on a solved assembly
  // that's a solver bug, but we still write SOMETHING so the UI never
  // shows a misleading "Auto" placeholder for an absent member.
  map.rafterProfile = resolveOrNotUsed(firstByRole('rafter'));
  map.postProfile = resolveOrNotUsed(firstByRole('post'));
  map.ledgerProfile = resolveOrNotUsed(findById('ledger'));

  // Front beam in mono/box pergolas lives at id 'outer-beam' with role
  // 'beam'. Box-perimeter pergolas have a separate 'box-perimeter-beam'
  // member; we surface that as a distinct override key.
  map.frontBeamProfile = resolveOrNotUsed(findById('outer-beam'));
  map.boxPerimeterBeamProfile = resolveOrNotUsed(findById('box-perimeter-beam'));

  // Family-conditional slots. Mono has no ridge / tie / strut → these
  // resolve to MEMBER_SIZE_NOT_USED so the UI shows "Not used" rather
  // than the misleading "Auto". Gable / hip populate them normally.
  map.ridgeBeamProfile = resolveOrNotUsed(firstByRole('ridge'));
  map.tieBeamProfile = resolveOrNotUsed(findById('tie-beam'));
  map.strutProfile = resolveOrNotUsed(findById('king-post-strut') ?? firstByRole('brace'));

  return map;
}
