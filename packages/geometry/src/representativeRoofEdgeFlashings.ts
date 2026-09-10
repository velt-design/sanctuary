import { centredTrayLayout, representativeRoofProfile, type RepresentativeRoofProfile } from './representativeRoofProfiles';
import { roofQuad, roofSlab, type RoofCoordinates, type RoofRectangle } from './representativeRoofFinishMesh';
import type { RoofFinishMesh } from './representativeRoofFinishTypes';

/** Visible folded edge covers; tray side wings lap the complete first seam crown. */
export function addRoofEdgeFlashings(mesh: RoofFinishMesh, frame: RoofCoordinates, r: RoofRectangle,
  profile: RepresentativeRoofProfile, trayWidth: 300 | 400 | 500) {
  const height = representativeRoofProfile(profile, trayWidth).height + 4;
  const cover = Math.min((r.b - r.a) / 2, profile === 'tray' ? centredTrayLayout(r.a, r.b, trayWidth).sideCover : 90);
  const endCover = Math.min(90, (r.d - r.c) / 2);
  const front = r.c - 2, back = r.d + 2;
  // End covers meet the side covers without coplanar overlapping faces.
  roofSlab(mesh, frame, { a: r.a - 20, b: r.b + 20, c: front, d: r.c + endCover }, height, height + 1);
  roofSlab(mesh, frame, { a: r.a - 20, b: r.b + 20, c: r.d - endCover, d: back }, height, height + 1);
  for (const [a, b] of [[r.a - 20, r.a + cover], [r.b - cover, r.b + 20]])
    roofSlab(mesh, frame, { a, b, c: r.c + endCover, d: r.d - endCover }, height, height + 1);
  for (const a of [r.a - 20, r.b + 20]) roofQuad(mesh, [frame.point(a, front, -15),
    frame.point(a, back, -15), frame.point(a, back, height), frame.point(a, front, height)]);
  for (const b of [front, back]) roofQuad(mesh, [frame.point(r.a - 20, b, -15),
    frame.point(r.b + 20, b, -15), frame.point(r.b + 20, b, height), frame.point(r.a - 20, b, height)]);
}
