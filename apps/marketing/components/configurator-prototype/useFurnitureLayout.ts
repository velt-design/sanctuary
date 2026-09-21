import { useEffect, useMemo, useState } from 'react';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { furnitureFits, studioFurnitureLayout } from './studioFurnitureLayout';

/** Keep useful furniture still while sizing; choose a new set only after a pause. */
export function useFurnitureLayout(plan: GeometryPlanViewModel, preference?: 'social' | 'mixed') {
  const key = JSON.stringify({ extents: plan.extents, posts: plan.members.posts.map(p => ({ x: p.centerline.start.x, y: p.centerline.start.y, radius: p.profile.widthMm / 2 })), preference });
  const snapshot = useMemo(() => JSON.parse(key) as {
    extents: GeometryPlanViewModel['extents']; posts: { x: number; y: number; radius: number }[]; preference?: 'social' | 'mixed';
  }, [key]);
  const [settled, setSettled] = useState(() => ({ key, layout: studioFurnitureLayout(snapshot.extents, snapshot.posts, snapshot.preference) }));
  useEffect(() => {
    if (key === settled.key) return;
    const timer = setTimeout(() => {
      const next = studioFurnitureLayout(snapshot.extents, snapshot.posts, snapshot.preference);
      setSettled(previous => {
        const stillFits = previous.layout.every(item => furnitureFits(item, snapshot.extents, snapshot.posts));
        const sameSet = previous.layout.length === next.length && previous.layout.every((item, i) => item.kind === next[i].kind && item.rotation === next[i].rotation);
        return { key, layout: stillFits && sameSet ? previous.layout : next };
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [key, snapshot, settled.key]);
  // A shrinking footprint must never leave furniture outside its usable space.
  return useMemo(() => {
    const valid = settled.layout.filter(item => furnitureFits(item, snapshot.extents, snapshot.posts));
    return valid.length === settled.layout.length ? settled.layout : valid;
  }, [settled.layout, snapshot]);
}
