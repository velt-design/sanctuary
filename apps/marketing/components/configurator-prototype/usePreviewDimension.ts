import { useCallback, useEffect, useRef, useState } from 'react';

export type PreviewDimensionAxis = 'width' | 'projection';

export function usePreviewDimension() {
  const [activeDimension, setActiveDimension] = useState<PreviewDimensionAxis | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showDimension = useCallback((axis: PreviewDimensionAxis | null) => {
    if (timer.current) clearTimeout(timer.current);
    if (axis) setActiveDimension(axis);
    else timer.current = setTimeout(() => setActiveDimension(null), 1000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { activeDimension, showDimension };
}
