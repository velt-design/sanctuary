import { act, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import { addWebsitePergola, positionWebsitePergola, websiteComposition } from '@/lib/designStudio/websiteComposition';
import { changeStudioProduct } from '@/lib/designStudio/studioHouseCommands';
import { prepareGestureTemplates, rebaseGestureTemplates, templateFingerprint } from './directDemo/gestureTemplates';
import { useStudioDirectPlacement } from './useStudioDirectPlacement';

type Request = { requestId: number; edit: StudioAuthoringEdit };
let worker: TestWorker, current: StudioAuthoringEdit, replace: (edit: StudioAuthoringEdit) => void;
let api: ReturnType<typeof useStudioDirectPlacement>;
let mount: ReturnType<typeof renderIntoDocument> | undefined;
class TestWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  requests: Request[] = [];
  constructor() { worker = this; }
  postMessage(request: Request) { this.requests.push(structuredClone(request)); }
  terminate() {}
  reply(request = this.requests.at(-1)!) {
    try {
      const pack = prepareGestureTemplates(request.edit);
      this.onmessage?.({ data: { requestId: request.requestId, pack } } as MessageEvent);
    } catch (error) {
      this.onmessage?.({ data: { requestId: request.requestId, error: (error as Error).message } } as MessageEvent);
    }
  }
}
function initial() {
  const edit: StudioAuthoringEdit = {
    schemaVersion: 'studio_authoring_edit.v1', designId: 'raw-geometry-proof', revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT), site: {}, objectOptions: [], deletions: [],
  };
  const added = addWebsitePergola(edit, 'p');
  const value = websiteComposition(added)[0].value!;
  return changeStudioProduct(added, {
    ...value, selection: { ...value.selection, roof: {
      ...value.selection.roof, attachmentIntent: 'freestanding',
      roofBattens: { profile: '39x39', edge: false, gap: 50, customGap: true },
    } },
  });
}
function Harness() {
  const [edit, setEdit] = useState(initial);
  current = edit; replace = setEdit;
  api = useStudioDirectPlacement(edit, setEdit, false);
  return null;
}
function open() { mount = renderIntoDocument(<Harness />); act(() => worker.reply()); }
function raw(field: 'widthMm' | 'projectionMm' | 'roof', value: string) {
  const previous = websiteComposition(current)[0].value!;
  return changeStudioProduct(current, field === 'roof'
    ? { ...previous, rawGaps: { ...previous.rawGaps, roof: value } }
    : { ...previous, rawDimensions: { ...previous.rawDimensions, [field]: value } });
}
beforeEach(() => { vi.stubGlobal('Worker', TestWorker); });
afterEach(() => { mount?.unmount(); mount = undefined; vi.unstubAllGlobals(); });

it.each([['widthMm', '6500'], ['projectionMm', '3500'], ['roof', '75']] as const)(
  'prepares the actual requested %s geometry, then restores dragging without reload',
  (field, value) => {
    open();
    expect(api.directDrag.canDrag!('p')).toBe(true);
    const old = current, pack = prepareGestureTemplates(old), count = worker.requests.length;
    const edited = raw(field, value);
    expect(templateFingerprint(edited)).not.toBe(templateFingerprint(old));
    expect(() => rebaseGestureTemplates(edited, pack)).toThrow('another design');
    // Per-variant identity also rejects old geometry if the outer identity is
    // incorrectly relabelled. This catches silent free-product hull reuse.
    expect(() => rebaseGestureTemplates(edited, { ...pack, fingerprint: templateFingerprint(edited) }))
      .toThrow('This geometry has not been prepared');
    act(() => replace(edited));
    expect(worker.requests).toHaveLength(count + 1);
    expect(worker.requests.at(-1)!.edit).toEqual(edited);
    expect(api.directDrag.canDrag!('p')).toBe(false);
    act(() => worker.reply());
    expect(api.directDrag.canDrag!('p')).toBe(true);
    expect(api.message).toBeNull();
    const fresh = rebaseGestureTemplates(edited, prepareGestureTemplates(edited)).get('p:facade')!;
    act(() => api.directDrag.begin!('p'));
    expect(api.footprint!.original).toEqual(fresh.original);
    expect(fresh.row.design).toEqual(websiteComposition(edited)[0].design);
    if (field === 'roof') expect(fresh.row.design!.roof.roofBattens!.gap).toBe(75);
    else expect(fresh.row.design!.input[field]).toBe(Number(value));
    act(() => api.directDrag.finish(false));
    expect(current).toEqual(edited);
  },
);

it('ignores an old worker response while a later dimension edit is preparing', () => {
  open();
  act(() => replace(raw('widthMm', '6500')));
  const first = worker.requests.at(-1)!;
  act(() => replace(raw('widthMm', '7000')));
  const latest = worker.requests.at(-1)!;
  act(() => worker.reply(first));
  expect(api.directDrag.canDrag!('p')).toBe(false);
  act(() => worker.reply(latest));
  expect(api.directDrag.canDrag!('p')).toBe(true);
  act(() => worker.reply(first));
  expect(api.directDrag.canDrag!('p')).toBe(true);
  expect(api.message).toBeNull();
  expect(websiteComposition(current)[0].design!.input.widthMm).toBe(7000);
});

it('retains invalid raw input, disables stale geometry and recovers after valid input', () => {
  open();
  act(() => replace(raw('widthMm', 'bad')));
  act(() => worker.reply());
  expect(api.directDrag.canDrag!('p')).toBe(false);
  expect(api.message).toContain('positive whole millimetre');
  expect(websiteComposition(current)[0].value!.rawDimensions.widthMm).toBe('bad');
  act(() => replace(raw('widthMm', '6500')));
  act(() => worker.reply());
  expect(api.directDrag.canDrag!('p')).toBe(true);
  expect(api.message).toBeNull();
});

it('reuses prepared local geometry for translation-only edits', () => {
  open();
  const count = worker.requests.length, fingerprint = templateFingerprint(current);
  const moved = positionWebsitePergola(current, 'p', { originXMm: '123', originYMm: '456' });
  expect(templateFingerprint(moved)).toBe(fingerprint);
  act(() => replace(moved));
  expect(worker.requests).toHaveLength(count);
  expect(api.directDrag.canDrag!('p')).toBe(true);
  act(() => api.directDrag.begin!('p'));
  expect(api.proposal).toMatchObject({ x: 123, y: 456 });
  act(() => api.directDrag.finish(false));
  expect(current).toEqual(moved);
});
