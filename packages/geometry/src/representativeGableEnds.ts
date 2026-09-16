import type { Assembly3D, AssemblyMember3D } from './contracts';

function halfExtentX(member: AssemblyMember3D) {
  return Math.abs(member.localFrame.yAxis.x) * member.profile.widthMm / 2
    + Math.abs(member.localFrame.zAxis.x) * member.profile.depthMm / 2;
}

function moveAcrossEnd(member: AssemblyMember3D, deltaX: number) {
  member.centerline = {
    start: { ...member.centerline.start, x: member.centerline.start.x + deltaX },
    end: { ...member.centerline.end, x: member.centerline.end.x + deltaX },
  };
  member.localFrame = { ...member.localFrame, origin: { ...member.centerline.start } };
}

/** Project each post's actual section after the whole assembly is oriented. */
export function recordRepresentativeGablePostFootprints(assembly: Assembly3D) {
  for (const post of assembly.members.filter(member => member.role === 'post')) {
    const extent = (axis: 'x' | 'y') => Number((Math.abs(post.localFrame.yAxis[axis]) * post.profile.widthMm
      + Math.abs(post.localFrame.zAxis[axis]) * post.profile.depthMm).toFixed(6));
    post.metadata = { ...post.metadata, footprintWidthMm: extent('x'), footprintProjectionMm: extent('y') };
  }
}

/** Finish the representative gable on the outside faces of its end rafters.
 * Work in the canonical ridge-along-X frame, before rotating either view.
 * Posts are already inset by their own half-width. No profile is resized here.
 */
export function alignRepresentativeGableEndFaces(assembly: Assembly3D) {
  const rafters = assembly.members.filter(member => member.role === 'rafter');
  const low = Math.min(...rafters.map(member => member.centerline.start.x - halfExtentX(member)));
  const high = Math.max(...rafters.map(member => member.centerline.start.x + halfExtentX(member)));
  for (const member of assembly.members) {
    if ((member.role === 'ridge' || member.role === 'gutter' || member.role === 'beam' || member.role === 'ledger')
      && Math.abs(member.localFrame.xAxis.x) > .999) {
      // Gutter cap metadata stays inside these endpoints, just like its body.
      const forward = member.centerline.end.x >= member.centerline.start.x;
      member.centerline = { start: { ...member.centerline.start, x: forward ? low : high }, end: { ...member.centerline.end, x: forward ? high : low } };
      member.localFrame = { ...member.localFrame, origin: { ...member.centerline.start } };
    }
  }
  for (const tie of assembly.members.filter(member => member.metadata?.frameRole === 'tie_beam')) {
    const outward = tie.metadata?.position === 'inner-end' ? -1 : 1;
    const plane = outward < 0 ? low : high;
    const flange = assembly.members.find(member => member.id === `${tie.id}-inside`)!;
    const frontFace = tie.centerline.start.x + outward * halfExtentX(tie);
    const deltaX = plane - frontFace;
    moveAcrossEnd(tie, deltaX);
    moveAcrossEnd(flange, deltaX);
    const king = assembly.members.find(member => member.metadata?.frameRole === 'king_post_strut' && member.metadata.position === tie.metadata?.position)!;
    // The rotated king now sits wholly on the L's top and meets the same face.
    moveAcrossEnd(king, plane - outward * halfExtentX(king) - king.centerline.start.x);
  }
}
