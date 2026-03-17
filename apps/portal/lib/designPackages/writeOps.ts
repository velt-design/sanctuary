import 'server-only';

import { POST as markDoneRoute } from '@/app/api/staff/v1/design-packages/[requestId]/action/mark_done/route';
import { POST as startRoute } from '@/app/api/staff/v1/design-packages/[requestId]/action/start/route';
import { getDesignListCellEditability, type NormalizedDesignListCellValue } from './editing';
import { loadDesignPackageRow, setDesignRequestPriorityTier, setDesignRequestStatus, updateDesignRequestDesignerNote } from './server';
import type { DesignListCellMutationResponse, DesignListEditableCellKey, DesignListRow } from './types';

type RouteHandler = (...args: any[]) => Promise<Response>;

async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function callRoute(handler: RouteHandler, body?: Record<string, unknown>, ctx?: any): Promise<any> {
  const req = new Request('http://localhost/internal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : null),
  });

  const res = ctx === undefined ? await handler(req) : await handler(req, ctx);
  const payload = await parseJsonSafe(res);
  if (!res.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

async function refreshRow(requestUuid: string): Promise<DesignListRow> {
  const row = await loadDesignPackageRow(requestUuid);
  if (!row) throw new Error('Design list row disappeared after save.');
  return row;
}

export async function applyDesignListCellMutation(input: {
  requestId: string;
  requestUuid: string;
  currentRow: DesignListRow;
  key: DesignListEditableCellKey;
  value: NormalizedDesignListCellValue;
}): Promise<DesignListCellMutationResponse> {
  const editability = getDesignListCellEditability(input.currentRow, input.key);
  if (!editability.editable) throw new Error(editability.reason ?? 'This cell is not editable.');

  switch (input.key) {
    case 'notes':
      await updateDesignRequestDesignerNote(input.requestId, typeof input.value === 'string' ? input.value : null);
      break;
    case 'design_ready':
      if (typeof input.value !== 'string') throw new Error('Design status is required.');
      if (input.value === 'IN_PROGRESS') {
        await callRoute(startRoute, undefined, { params: Promise.resolve({ requestId: input.requestId }) });
      } else if (input.value === 'DONE') {
        await callRoute(markDoneRoute, undefined, { params: Promise.resolve({ requestId: input.requestId }) });
      } else {
        if (input.value !== 'OPEN' && input.value !== 'BLOCKED' && input.value !== 'CANCELLED') {
          throw new Error('Unsupported design status.');
        }
        await setDesignRequestStatus(input.requestId, input.value);
      }
      break;
    case 'priority':
      if (
        input.value !== 'TIER_1' &&
        input.value !== 'TIER_2' &&
        input.value !== 'TIER_3' &&
        input.value !== 'TIER_4' &&
        input.value !== 'UNPRICED'
      ) {
        throw new Error('Unsupported design priority.');
      }
      await setDesignRequestPriorityTier(input.requestId, input.value);
      break;
    default: {
      const exhaustive: never = input.key;
      throw new Error(`Unsupported cell ${exhaustive}`);
    }
  }

  return {
    ok: true,
    updatedRow: await refreshRow(input.requestUuid),
  };
}
