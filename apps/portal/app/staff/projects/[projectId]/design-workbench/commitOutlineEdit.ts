import { buildSideLocalPolygonFromWorld } from '@sp/geometry';
import { tryConvertResizeToPresetParams } from './tryConvertResizeToPresetParams';
import { buildDeckTransformPatch } from '@/lib/drawings/commits/commitDeckTransform';
import type { EdgeDragCommit } from '@/components/drawings/viewports/PlanViewport/tools/EdgeDragTool';
import type { ReversibleCommandInput } from '@/lib/drawings/commands/createReversibleCommand';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { houseFormTransformToWorldPositionMm } from '@/lib/drawings/state/houseFormTransform';
import type { HouseFormModel, PergolaAttachment } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import { pergolaAttachmentFromSnap } from '@/lib/drawings/state/pergolaAttachment';
import {
  resolveObjectOwnedHouseActionContext,
  resolveSelectedHouseActionContext,
} from './objectWorkbenchActionContext';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';

function resolveHouseWorldPositionMm(
  houseForm: HouseFormModel | null,
): { x: number; y: number } | null {
  if (!houseForm) return null;
  const position = houseFormTransformToWorldPositionMm(houseForm.transform);
  return { x: position.x, y: position.y };
}

export type BuildOutlineEditCommitHandlerInput = {
  store: DrawingWorkbenchStore;
  objectWorkbenchActions: ObjectWorkbenchActions;
};

function resolveSelectedHouseForm(store: DrawingWorkbenchStore): HouseFormModel | null {
  return resolveSelectedHouseActionContext({
    activeObjectRef: store.ui.activeObjectRef,
    houseForms: store.derived.houseForms,
  })?.houseForm ?? null;
}

/**
 * Build the edge-drag commit handler shared across house/pergola/deck
 * outlines. Each family branch reads the dragged polygon out of `commit`,
 * computes the canonical persisted shape (atomic position + dimensions for
 * pergolas; position + side-local outline for houses and decks), and either
 * fires the action directly (house) or returns a `ReversibleCommandInput`
 * so the PlanViewport's CommandBus can wire it into undo/redo.
 *
 * Extracted from the inline handler in DesignWorkbenchEstimateClient so
 * each family path has a focused test surface and any future caller
 * (keyboard nudge, gizmo drag) can call the same factory. Behaviour is
 * preserved byte-for-byte for non-house branches.
 */
export function buildOutlineEditCommitHandler(
  input: BuildOutlineEditCommitHandlerInput,
): (commit: EdgeDragCommit) => ReversibleCommandInput | void {
  const { store, objectWorkbenchActions } = input;
  return (commit) => {
    if (commit.family === 'house_forms') {
      const houseForm = resolveSelectedHouseForm(store);
      if (!houseForm) return;
      const position = houseFormTransformToWorldPositionMm(houseForm.transform);
      const attachmentSide = houseForm.footprint.attachmentSide;
      const positionXMm = Number(position.x) || 0;
      const positionYMm = Number(position.y) || 0;
      const positionRotationDeg = Number(position.rotationDeg) || 0;
      const cos = Math.cos((positionRotationDeg * Math.PI) / 180);
      const sin = Math.sin((positionRotationDeg * Math.PI) / 180);
      const localWorldPolygon = commit.nextPolygon.map((p) => {
        const dx = p.x - positionXMm;
        const dy = p.y - positionYMm;
        // Inverse rotation (transpose).
        return {
          x: cos * dx + sin * dy,
          y: -sin * dx + cos * dy,
        };
      });
      // PR-WB-RESIZE-KEEPS-PRESET (2026-06-19): if the source form
      // is preset+straight AND the resize produced a clean axis-
      // aligned rectangle, recover (widthM, bandDepthM, offsetXM,
      // setbackM) from the polygon's form-local bounding box and
      // emit a preset_resize edit instead of a custom_polygon
      // edit. The form stays mode: 'preset'; composition stays
      // authoritative (re-synced by the normaliser); the seam-icon
      // layer + Join + Detach all keep working without falling
      // back to the custom_polygon-as-rectangle inference.
      const presetParamsConversion = tryConvertResizeToPresetParams({
        formLocalPolygonMm: localWorldPolygon,
        sourceMode: houseForm.footprint.mode,
        sourcePreset: houseForm.footprint.preset,
        sourceAttachmentSide: houseForm.footprint.attachmentSide,
        sourceRotationQuarterTurns: houseForm.transform.rotationQuarterTurns,
      });
      if (presetParamsConversion) {
        void objectWorkbenchActions.commitHouseFormFootprintEdit({
          houseFormId: houseForm.id,
          edit: {
            type: 'preset_resize',
            ...presetParamsConversion,
          },
        });
        return;
      }
      // Fallback: encode as a custom polygon. This path catches L /
      // U / recess / wrap preset resizes (richer params not handled
      // yet), rotated forms (transform-aware math TODO), non-rear
      // attachment sides, and any genuinely-not-rectangle resize.
      const sideLocalPoints = buildSideLocalPolygonFromWorld({
        worldPolygonMm: localWorldPolygon,
        pergolaWidthMm: 1000,
        pergolaDepthMm: 1000,
        attachmentSide,
        params: null,
      });
      void objectWorkbenchActions.commitHouseFormFootprintEdit({
        houseFormId: houseForm.id,
        edit: {
          type: 'custom_polygon',
          polygon: sideLocalPoints.map((p) => ({
            alongM: p.alongM.toString(),
            depthM: p.depthM.toString(),
          })),
        },
      });
      return;
    }
    if (commit.family === 'pergolas') {
      // Pergola edge-drag (first-class spatial entity write). The pergola
      // owns its own world position (origin + rotation around +Z), its
      // own dimensions (lengthM/projectionM), and its own snap-derived
      // attachment shape. An edge drag computes `bbox(nextPolygon)`:
      //   - bbox.min becomes the new `position.origin`
      //   - (max - min) becomes the new (lengthM, projectionM)
      //   - When the drag ended on a snap, the snap target derives a
      //     `PergolaAttachment` (host + spatialKind + method).
      //
      // ALL THREE are written in a single atomic patch via
      // `commitSharedPergolaEdgeDragResult`. Earlier this handler fired
      // up to four fire-and-forget commits in the same React tick;
      // each cloned the pre-tick draft and the last persist won, which
      // dropped position/dimension writes when the attachment write
      // landed last (visible bug: pergola "jumps back to original size"
      // on snap-release). The atomic action eliminates that race.
      //
      // Rotation: not handled yet. Pergolas with non-zero rotation need
      // bbox-aware drag math that operates in the local frame; deferred
      // until a rotate gizmo lands.
      const pergolaId =
        store.ui.activeObjectRef.family === 'pergolas'
          ? store.ui.activeObjectRef.objectId
          : null;
      if (!pergolaId || commit.nextPolygon.length < 3) return;
      const pergola = store.derived.activeObjectFirstPergola;
      const currentOriginXMm = Number(pergola?.position?.originXMm ?? '0');
      const currentOriginYMm = Number(pergola?.position?.originYMm ?? '0');
      const currentRotationDeg = Number(pergola?.position?.rotationDeg ?? '0');
      const currentLengthMm = Number(pergola?.geometry?.dimensions?.lengthM) * 1000;
      const currentProjectionMm = Number(pergola?.geometry?.dimensions?.projectionM) * 1000;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of commit.nextPolygon) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const nextOriginXMm = minX;
      const nextOriginYMm = minY;
      const nextLengthMm = Math.max(500, maxX - minX);
      const nextProjectionMm = Math.max(500, maxY - minY);
      const positionChanged =
        Math.abs(nextOriginXMm - currentOriginXMm) >= 1 ||
        Math.abs(nextOriginYMm - currentOriginYMm) >= 1;
      const lengthChanged =
        !Number.isFinite(currentLengthMm) ||
        Math.abs(nextLengthMm - currentLengthMm) >= 1;
      const projectionChanged =
        !Number.isFinite(currentProjectionMm) ||
        Math.abs(nextProjectionMm - currentProjectionMm) >= 1;
      // Build the atomic patch. The snap engine surfaces three host
      // edge kinds:
      //   - `wall` / `roof_eave` → host.objectFamily = 'house_forms'
      //   - `pergola_outline`    → host.objectFamily = 'pergolas'
      // Package geometry receives a derived connection enum from
      // `connectionTypeFromAttachment`. No snap -> leave the existing
      // attachment unchanged (caller can clear via the inspector if needed).
      let snapAttachment: PergolaAttachment | undefined = undefined;
      if (commit.snap) {
        const hostEdgeKind = commit.snap.target.edgeKind;
        if (
          hostEdgeKind === 'wall' ||
          hostEdgeKind === 'roof_eave' ||
          hostEdgeKind === 'pergola_outline'
        ) {
          const hostObjectFamily =
            hostEdgeKind === 'pergola_outline' ? 'pergolas' : 'house_forms';
          snapAttachment = pergolaAttachmentFromSnap({
            hostObjectFamily,
            hostObjectId: commit.snap.target.sourceObjectId,
            hostEdgeKind,
            hostEdgeId: commit.snap.target.id,
            // The dragged edge index — preserved on the
            // attachment so re-solves can recover alignment
            // (which polygon edge of MY pergola sits on the
            // host edge) without re-querying the snap engine.
            myEdgeIndex: commit.edgeIndex,
          });
        }
      }
      if (
        !positionChanged &&
        !lengthChanged &&
        !projectionChanged &&
        !snapAttachment
      ) {
        return;
      }
      // Forward fields = the new state the edge-drag commits to.
      // Inverse fields = the captured pre-edit state. We pass
      // ALL fields in the inverse (not just changed ones) so the
      // restore is complete -- e.g. if the edit changed only
      // lengthMm + attachment, undo still re-applies the
      // original position to keep the pergola identical to
      // pre-edit state. The action no-ops when fields don't
      // differ, so passing extras is cheap.
      const forwardFields = {
        ...(positionChanged
          ? {
              position: {
                originXMm: nextOriginXMm,
                originYMm: nextOriginYMm,
                rotationDeg: Number.isFinite(currentRotationDeg)
                  ? currentRotationDeg
                  : 0,
              },
            }
          : null),
        ...(lengthChanged ? { lengthMm: nextLengthMm } : null),
        ...(projectionChanged ? { projectionMm: nextProjectionMm } : null),
        ...(snapAttachment ? { attachment: snapAttachment } : null),
      };
      const previousAttachment = pergola?.attachment ?? null;
      const inverseFields = {
        position: {
          originXMm: currentOriginXMm,
          originYMm: currentOriginYMm,
          rotationDeg: Number.isFinite(currentRotationDeg)
            ? currentRotationDeg
            : 0,
        },
        ...(Number.isFinite(currentLengthMm) ? { lengthMm: currentLengthMm } : null),
        ...(Number.isFinite(currentProjectionMm)
          ? { projectionMm: currentProjectionMm }
          : null),
        attachment: previousAttachment,
      };
      return {
        label: `Resize pergola ${pergolaId}`,
        apply: () => {
          void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
            pergolaId,
            forwardFields,
          );
        },
        invert: () => {
          void objectWorkbenchActions.commitSharedPergolaEdgeDragResult(
            pergolaId,
            inverseFields,
          );
        },
      };
    }
    if (commit.family === 'decks') {
      // Deck edge-drag commit (stage 4 — deck first-class spatial
      // entity). The deck owns its own world `position` and its
      // outline is stored in side-local `(alongM, depthM)` coords
      // decoded against a unit (1m × 1m) frame. Position is
      // applied as a post-decode translation, decoupling the
      // deck from the host's `attachmentSide` and from pergola
      // dimensions.
      //
      // Bbox approach (parallel to pergola): `bbox.min(nextPolygon)`
      // becomes the new deck `position.origin`; the polygon is
      // shifted by `-position` and re-encoded against the unit
      // frame. Whether this is a first edit (position was null)
      // or a subsequent edit, the same logic produces the
      // canonical (position, polygon) pair.
      //
      // Resolve deckId from `commit.outlineId` (shape id =
      // `${type}:${id}` rather than `activeObjectRef`. The
      // active ref's `objectId` can be null mid-render (when the
      // ref normalizer can't yet match it against the current
      // deck list during object-first draft hydration) but
      // the EdgeDragTool always emits the shape it actually
      // dragged, so the outline is the source of truth.
      //
      // Outline id formats (any of these may appear depending on
      // which canonical-outline shape the picker chose):
      //   `house_surface:${deck.id}`       — top-projected surface
      //   `house_surface_solid:house-solid-${deck.id}` — solid prism
      // Match by checking deck.id as a suffix of outlineId; this
      // is robust against either prefix without fragile parsing.
      const projectModelDecks = store.persisted.projectModel.decks;
      const matchedDeck = projectModelDecks.find((deck) =>
        commit.outlineId.endsWith(`:${deck.id}`) ||
        commit.outlineId.endsWith(`-${deck.id}`),
      );
      const deckId = matchedDeck?.id ?? null;
      if (!deckId || commit.nextPolygon.length < 3) return;
      // House world position is needed so `buildDeckTransformPatch`
      // can convert the world bbox.min into a house-local
      // `deck.position` (the geometry decoder applies
      // `deck.position + house.position`, so the persisted
      // value must be in house-local coords; otherwise each
      // commit would re-add house.position and the deck
      // would drift).
      const resolvedHouse = resolveObjectOwnedHouseActionContext({
        target: { family: 'decks', objectId: deckId },
        houseForms: store.derived.houseForms,
        decks: projectModelDecks,
      });
      const houseWorldPositionMm = resolveHouseWorldPositionMm(
        resolvedHouse?.houseForm ?? null,
      );
      if (!houseWorldPositionMm) return;
      const patch = buildDeckTransformPatch({
        worldPolygonMm: commit.nextPolygon,
        currentRotationDeg: matchedDeck?.position?.rotationDeg,
        houseWorldPositionMm,
      });
      if (!patch) return;
      // Capture the pre-edit shape-defining fields so undo can
      // restore them. The forward patch always lands as
      // `shape: 'custom'` + outline + position; the inverse must
      // carry whatever the deck had before (preset, floating, or
      // a different custom outline). Including all candidates
      // keeps the inverse correct regardless of the prior shape
      // -- partial patches ignore irrelevant fields.
      const previousDeckPatch: ObjectWorkbenchDeckPatch = matchedDeck
        ? {
            shape: matchedDeck.shape,
            outline: matchedDeck.outline,
            position: matchedDeck.position ?? null,
            presetType: matchedDeck.presetType ?? null,
            presetRect: matchedDeck.presetRect ?? null,
            floatingRect: matchedDeck.floatingRect ?? null,
          }
        : { shape: 'custom', outline: [], position: null };
      return {
        label: `Resize deck ${deckId}`,
        apply: () => {
          void objectWorkbenchActions.commitSharedHouseDeckPatch(deckId, patch);
        },
        invert: () => {
          void objectWorkbenchActions.commitSharedHouseDeckPatch(
            deckId,
            previousDeckPatch,
          );
        },
      };
    }
    // openings deferred (no canonical polygon yet).
    console.warn('[edge-drag] outline edit not yet wired for family:', commit.family, commit);
  };
}
