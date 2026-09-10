/** Nominal visible profiles from the owner's Steel & Tube references.
 * Concealed locks and the trapezoidal pan stiffeners are intentionally omitted. */
export type RepresentativeRoofProfile = 'corrugated' | 'trapezoidal' | 'tray';
export type RoofProfilePoint = { across: number; height: number };

/** Equal edge cuts, with whole seam crowns inside the region. */
export function centredTrayLayout(start: number, end: number, pitch: number) {
  const intervals = Math.max(0, Math.floor((end - start - 23) / pitch));
  const firstSeam = (start + end - intervals * pitch) / 2;
  return { origin: firstSeam - pitch + 11.5, firstSeam, lastSeam: firstSeam + intervals * pitch,
    sideCover: firstSeam - start + 21.5 };
}

export function representativeRoofProfile(profile: RepresentativeRoofProfile, trayWidth: 300 | 400 | 500 = 400) {
  if (profile === 'corrugated') return { pitch: 76.2, height: 17,
    points: Array.from({ length: 13 }, (_, i) => ({ across: 76.2 * i / 12, height: 8.5 * (1 - Math.cos(i / 12 * Math.PI * 2)) })) };
  if (profile === 'trapezoidal') return { pitch: 154, height: 21, points: [
    { across: 0, height: 0 }, { across: 107, height: 0 }, { across: 121.5, height: 21 },
    { across: 139.5, height: 21 }, { across: 154, height: 0 },
  ] };
  return { pitch: trayWidth, height: 39, points: [
    { across: 0, height: 0 }, { across: trayWidth - 23, height: 0 },
    { across: trayWidth - 18, height: 39 }, { across: trayWidth - 5, height: 39 }, { across: trayWidth, height: 0 },
  ] };
}

/** Cut the repeated profile at real region edges; no overlapping full sheets. */
export function roofProfileSection(profile: RepresentativeRoofProfile, start: number, end: number, trayWidth: 300 | 400 | 500): RoofProfilePoint[] {
  const { pitch, points } = representativeRoofProfile(profile, trayWidth);
  const origin = profile === 'tray' ? centredTrayLayout(start, end, trayWidth).origin : 0;
  const samples: RoofProfilePoint[] = [];
  for (let repeat = Math.floor((start - origin) / pitch); repeat <= Math.floor((end - origin) / pitch); repeat++) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = { across: origin + repeat * pitch + points[i].across, height: points[i].height };
      const b = { across: origin + repeat * pitch + points[i + 1].across, height: points[i + 1].height };
      if (b.across <= start || a.across >= end) continue;
      const at = (x: number) => ({ across: x, height: a.height + (b.height - a.height) * (x - a.across) / (b.across - a.across) });
      if (!samples.length) samples.push(at(Math.max(a.across, start)));
      samples.push(at(Math.min(b.across, end)));
    }
  }
  return samples;
}
