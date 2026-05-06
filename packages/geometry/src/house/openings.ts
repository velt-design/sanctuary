import type { HouseModel3D, HouseOpening3D } from '../contracts';

export function buildHouseOpenings(input: {
  openings: NonNullable<HouseModel3D['openings']>;
}): HouseOpening3D[] {
  return input.openings
    .flatMap((opening): HouseOpening3D[] => {
      if (!opening?.id) return [];
      if (
        !Number.isFinite(opening.widthMm) ||
        !Number.isFinite(opening.heightMm) ||
        !Number.isFinite(opening.sillHeightMm) ||
        !Number.isFinite(opening.offsetAlongWallMm)
      ) {
        return [];
      }
      const kind =
        opening.kind === 'hinged_door' ||
        opening.kind === 'slider' ||
        opening.kind === 'stacker' ||
        opening.kind === 'window'
          ? opening.kind
          : 'window';
      return [{
        ...opening,
        kind,
        panelCount:
          kind === 'slider'
            ? opening.panelCount === 3 || opening.panelCount === 4
              ? opening.panelCount
              : 2
            : null,
        wallId:
          opening.wallId === 'front' ||
          opening.wallId === 'left' ||
          opening.wallId === 'right'
            ? opening.wallId
            : 'rear',
        hostEdgeId: typeof opening.hostEdgeId === 'string' ? opening.hostEdgeId.trim() || null : null,
        widthMm: Math.max(0, Math.round(opening.widthMm)),
        heightMm: Math.max(0, Math.round(opening.heightMm)),
        sillHeightMm: Math.max(0, Math.round(opening.sillHeightMm)),
        offsetAlongWallMm: Math.max(0, Math.round(opening.offsetAlongWallMm)),
        validationStatus: opening.validationStatus === 'invalid' ? 'invalid' : 'valid',
        validationCodes: opening.validationCodes ?? [],
        validationMessage: opening.validationMessage ?? null,
      }];
    });
}
