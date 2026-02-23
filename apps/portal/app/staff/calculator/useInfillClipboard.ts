import { useCallback, useState } from 'react';
import type { InfillLineItem } from '@/lib/types/calculator';
import { normalizePanelOrientation } from './infillCompute';

export type InfillGeometryClipboard = {
  shape: InfillLineItem['shape'];
  panelOrientation: InfillLineItem['panelOrientation'];
  maxPanelWidthM: string;
  targetPanelWidthM: string;
};

function cloneShape(shape: InfillLineItem['shape']): InfillLineItem['shape'] {
  if (shape.type === 'mono_slope') {
    return {
      type: 'mono_slope',
      widthM: shape.widthM,
      heightLowM: shape.heightLowM,
      heightHighM: shape.heightHighM,
      bottomOffsetM: shape.bottomOffsetM ?? '0',
    };
  }
  return {
    type: 'rect',
    widthM: shape.widthM,
    heightM: shape.heightM,
    bottomOffsetM: shape.bottomOffsetM ?? '0',
  };
}

function toClipboardPayload(item: InfillLineItem): InfillGeometryClipboard {
  return {
    shape: cloneShape(item.shape),
    panelOrientation: normalizePanelOrientation(item.panelOrientation),
    maxPanelWidthM: item.maxPanelWidthM,
    targetPanelWidthM: item.targetPanelWidthM,
  };
}

export function useInfillClipboard() {
  const [clipboard, setClipboard] = useState<InfillGeometryClipboard | null>(null);

  const copyGeometry = useCallback(async (item: InfillLineItem): Promise<InfillGeometryClipboard> => {
    const payload = toClipboardPayload(item);
    setClipboard(payload);

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            type: 'sanctuary.infill.geometry',
            payload,
          },
          null,
          2,
        ),
      );
    } catch {
      // Keep local clipboard even if system clipboard is unavailable.
    }

    return payload;
  }, []);

  const pasteGeometry = useCallback(
    (item: InfillLineItem): Partial<InfillLineItem> | null => {
      if (!clipboard) return null;
      return {
        shape: cloneShape(clipboard.shape),
        panelOrientation: normalizePanelOrientation(clipboard.panelOrientation),
        maxPanelWidthM: clipboard.maxPanelWidthM,
        targetPanelWidthM: clipboard.targetPanelWidthM,
      };
    },
    [clipboard],
  );

  return {
    clipboard,
    hasClipboard: Boolean(clipboard),
    copyGeometry,
    pasteGeometry,
  };
}
