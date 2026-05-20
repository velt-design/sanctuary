import { describe, expect, it, vi } from 'vitest';
import type { EdgeDragCommit } from '@/components/drawings/viewports/PlanViewport/tools/EdgeDragTool';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { buildOutlineEditCommitHandler } from './commitOutlineEdit';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';

// The handler reads a narrow slice of the store and dispatches into the
// action namespace. Tests stub both: a partial store cast to the full type,
// plus a vi.fn-backed actions namespace. The boundary contract we exercise
// is "edge-drag commit in -> correct action with expected payload out" for
// each `commit.family`. Behaviour preservation -- not a re-derivation of
// the geometry math, which lives in the helpers each branch delegates to.

type StoreStubInput = {
  activeRailRef?:
    | { family: 'pergolas'; objectId: string | null }
    | { family: 'house_forms'; objectId: string | null }
    | { family: 'decks'; objectId: string | null };
  activeHouseForm?: {
    footprint: { attachmentSide: 'rear' | 'left' | 'right' | 'front' };
  } | null;
  activeObjectFirstPergola?: {
    position?: { originXMm: string; originYMm: string; rotationDeg: string } | null;
    attachment?: unknown | null;
  } | null;
  decks?: Array<{
    id: string;
    shape: 'custom' | 'preset' | 'floating';
    outline: Array<{ alongM: string; depthM: string }>;
    position?: { originXMm: string; originYMm: string; rotationDeg: string } | null;
    presetType?: string | null;
    presetRect?: unknown | null;
    floatingRect?: unknown | null;
  }>;
};

function stubStore(input: StoreStubInput = {}): DrawingWorkbenchStore {
  return {
    persisted: {
      projectModel: {
        decks: input.decks ?? [],
      },
    },
    ui: {
      activeObjectRef: input.activeRailRef ?? { family: 'house_forms', objectId: null },
    },
    derived: {
      activeHouseForm: input.activeHouseForm ?? null,
      activeObjectFirstPergola: input.activeObjectFirstPergola ?? null,
    },
  } as unknown as DrawingWorkbenchStore;
}

function stubActions(): ObjectWorkbenchActions {
  return {
    commitSharedHouseFootprintEdit: vi.fn().mockResolvedValue({ ok: true }),
    commitSharedPergolaEdgeDragResult: vi.fn().mockResolvedValue({ ok: true }),
    commitSharedHouseDeckPatch: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as ObjectWorkbenchActions;
}

const SQUARE_2M: EdgeDragCommit['nextPolygon'] = [
  { x: 0, y: 0 },
  { x: 2000, y: 0 },
  { x: 2000, y: 2000 },
  { x: 0, y: 2000 },
];

describe('buildOutlineEditCommitHandler', () => {
  describe('house_forms branch', () => {
    it('writes the migration default position THEN polygon when houseFootprintPosition is null', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          activeHouseForm: { footprint: { attachmentSide: 'rear' } },
        }),
        activeModuleInput: {
          houseFootprintPosition: null,
          lengthM: '6',
          projectionM: '3',
        } as never,
        objectWorkbenchActions: actions,
      });
      handler({
        outlineId: 'house_surface:house-1',
        family: 'house_forms',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      const calls = (actions.commitSharedHouseFootprintEdit as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[0]).toEqual({
        type: 'position',
        position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
      });
      expect(calls[1]?.[0].type).toBe('custom_polygon');
    });

    it('skips the position write when houseFootprintPosition is already persisted', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          activeHouseForm: { footprint: { attachmentSide: 'rear' } },
        }),
        activeModuleInput: {
          houseFootprintPosition: { originXMm: '500', originYMm: '700', rotationDeg: '0' },
          lengthM: '6',
          projectionM: '3',
        } as never,
        objectWorkbenchActions: actions,
      });
      handler({
        outlineId: 'house_surface:house-1',
        family: 'house_forms',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      const calls = (actions.commitSharedHouseFootprintEdit as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0].type).toBe('custom_polygon');
    });

    it('uses front-attachment migration default (Y shift) when attachment is front', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          activeHouseForm: { footprint: { attachmentSide: 'front' } },
        }),
        activeModuleInput: {
          houseFootprintPosition: null,
          lengthM: '6',
          projectionM: '4',
        } as never,
        objectWorkbenchActions: actions,
      });
      handler({
        outlineId: 'house_surface:house-1',
        family: 'house_forms',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      const positionCall = (
        actions.commitSharedHouseFootprintEdit as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0];
      expect(positionCall).toEqual({
        type: 'position',
        position: { originXMm: '0', originYMm: '3000', rotationDeg: '0' },
      });
    });

    it('defaults attachmentSide to rear when no house form is active', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({ activeHouseForm: null }),
        activeModuleInput: {
          houseFootprintPosition: null,
          lengthM: '6',
          projectionM: '3',
        } as never,
        objectWorkbenchActions: actions,
      });
      handler({
        outlineId: 'house_surface:house-1',
        family: 'house_forms',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      const positionCall = (
        actions.commitSharedHouseFootprintEdit as ReturnType<typeof vi.fn>
      ).mock.calls[0]?.[0];
      expect(positionCall.position).toEqual({ originXMm: '0', originYMm: '0', rotationDeg: '0' });
    });
  });

  describe('pergolas branch', () => {
    it('returns null when the active object is not a pergola', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({ activeRailRef: { family: 'house_forms', objectId: 'house-1' } }),
        activeModuleInput: {} as never,
        objectWorkbenchActions: actions,
      });
      const result = handler({
        outlineId: 'pergola_outline:pergola-1',
        family: 'pergolas',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(result).toBeUndefined();
      expect(actions.commitSharedPergolaEdgeDragResult).not.toHaveBeenCalled();
    });

    it('returns null when the polygon has fewer than 3 points', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({ activeRailRef: { family: 'pergolas', objectId: 'pergola-1' } }),
        activeModuleInput: {} as never,
        objectWorkbenchActions: actions,
      });
      const result = handler({
        outlineId: 'pergola_outline:pergola-1',
        family: 'pergolas',
        edgeIndex: 0,
        nextPolygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        snap: null,
      });
      expect(result).toBeUndefined();
      expect(actions.commitSharedPergolaEdgeDragResult).not.toHaveBeenCalled();
    });

    it('returns a reversible command whose apply writes the atomic patch', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          activeRailRef: { family: 'pergolas', objectId: 'pergola-1' },
          activeObjectFirstPergola: {
            position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
          },
        }),
        activeModuleInput: { lengthM: '1', projectionM: '1' } as never,
        objectWorkbenchActions: actions,
      });
      const command = handler({
        outlineId: 'pergola_outline:pergola-1',
        family: 'pergolas',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(command).not.toBeUndefined();
      expect(command!.label).toBe('Resize pergola pergola-1');
      command!.apply();
      const applyCall = (
        actions.commitSharedPergolaEdgeDragResult as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(applyCall?.[0]).toBe('pergola-1');
      expect(applyCall?.[1].lengthMm).toBe(2000);
      expect(applyCall?.[1].projectionMm).toBe(2000);
    });

    it("invert restores the pre-edit position even for fields that did not change", () => {
      // The handler captures ALL inverse fields (not just changed ones) so
      // undo restores the pergola identically. Asserting the position is
      // present even though only dimensions changed in this drag.
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          activeRailRef: { family: 'pergolas', objectId: 'pergola-1' },
          activeObjectFirstPergola: {
            position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
          },
        }),
        activeModuleInput: { lengthM: '1', projectionM: '1' } as never,
        objectWorkbenchActions: actions,
      });
      const command = handler({
        outlineId: 'pergola_outline:pergola-1',
        family: 'pergolas',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      command!.invert();
      const invertCall = (
        actions.commitSharedPergolaEdgeDragResult as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(invertCall?.[1].position).toEqual({
        originXMm: 0,
        originYMm: 0,
        rotationDeg: 0,
      });
      expect(invertCall?.[1].lengthMm).toBe(1000);
    });
  });

  describe('decks branch', () => {
    it('matches the deck by id-suffix of outlineId (house_surface:<id>)', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          decks: [{ id: 'deck-1', shape: 'custom', outline: [] }],
        }),
        activeModuleInput: { houseFootprintPosition: null } as never,
        objectWorkbenchActions: actions,
      });
      const command = handler({
        outlineId: 'house_surface:deck-1',
        family: 'decks',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(command).not.toBeUndefined();
      expect(command!.label).toBe('Resize deck deck-1');
      command!.apply();
      const applyCall = (
        actions.commitSharedHouseDeckPatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(applyCall?.[0]).toBe('deck-1');
    });

    it('matches the deck by id-suffix of solid-prism outlineId (house_surface_solid:house-solid-<id>)', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          decks: [{ id: 'deck-2', shape: 'custom', outline: [] }],
        }),
        activeModuleInput: { houseFootprintPosition: null } as never,
        objectWorkbenchActions: actions,
      });
      const command = handler({
        outlineId: 'house_surface_solid:house-solid-deck-2',
        family: 'decks',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(command).not.toBeUndefined();
      expect(command!.label).toBe('Resize deck deck-2');
    });

    it('returns nothing when no deck matches outlineId', () => {
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({ decks: [{ id: 'deck-1', shape: 'custom', outline: [] }] }),
        activeModuleInput: { houseFootprintPosition: null } as never,
        objectWorkbenchActions: actions,
      });
      const result = handler({
        outlineId: 'house_surface:unknown-deck',
        family: 'decks',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(result).toBeUndefined();
      expect(actions.commitSharedHouseDeckPatch).not.toHaveBeenCalled();
    });

    it("invert restores the deck's pre-edit shape fields", () => {
      const actions = stubActions();
      const previousOutline = [
        { alongM: '0', depthM: '0' },
        { alongM: '1', depthM: '0' },
      ];
      const handler = buildOutlineEditCommitHandler({
        store: stubStore({
          decks: [{ id: 'deck-1', shape: 'custom', outline: previousOutline }],
        }),
        activeModuleInput: { houseFootprintPosition: null } as never,
        objectWorkbenchActions: actions,
      });
      const command = handler({
        outlineId: 'house_surface:deck-1',
        family: 'decks',
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      command!.invert();
      const invertCall = (
        actions.commitSharedHouseDeckPatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(invertCall?.[1].outline).toEqual(previousOutline);
    });
  });

  describe('openings branch (deferred)', () => {
    it('logs a warning and returns nothing for openings family', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const actions = stubActions();
      const handler = buildOutlineEditCommitHandler({
        store: stubStore(),
        activeModuleInput: null,
        objectWorkbenchActions: actions,
      });
      const result = handler({
        outlineId: 'opening:opening-1',
        family: 'openings' as never,
        edgeIndex: 0,
        nextPolygon: SQUARE_2M,
        snap: null,
      });
      expect(result).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
