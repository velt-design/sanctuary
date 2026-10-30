"use client";
import { frameAppearance } from "./productAppearance";
import { SceneObjectNode } from "@sp/geometry-viewer/react";
import type { ViewerSceneModel, RoofFinishGeometry } from "@sp/geometry";
import PreviewBlinds from "./PreviewBlinds";
import PreviewRoof from "./PreviewRoof";
import PreviewRoofFinish from "./PreviewRoofFinish";
import PergolaLightFixtures from "./PergolaLightFixtures";
import { useLighting } from "./LightingProvider";
import { usePreviewBlinds } from "./PreviewBlindProvider";
import { useSceneRenderingUpgrade } from "./SceneRenderingUpgrade";
import { useRealismStudy } from "./RealismStudy";
import StructuralFinish from "./StructuralFinish";
const noop = () => {};
/** The website's actual product subtree, reusable inside one composition Canvas. */
export default function PreviewProductNode({
  scene,
  covering,
  choiceView,
  reviewSetting = false,
  selected = false,
  onSelect,
  interactiveChoices = false,
}: {
  scene: ViewerSceneModel;
  covering?: RoofFinishGeometry;
  choiceView?: "sides" | "lighting";
  reviewSetting?: boolean;
  selected?: boolean;
  /** Composition owner selection, including solid members which stop bubbling. */ onSelect?: () => void;
  /** Opt in to the existing opening workspace. Public preview defaults stay presentation only. */ interactiveChoices?: boolean;
}) {
  const enhanced = useSceneRenderingUpgrade(),
    realism = useRealismStudy();
  const studio = true,
    lighting = useLighting(),
    blindWorkspace = usePreviewBlinds();
  const objects = scene.layers
    .filter((layer) => layer.visibleByDefault)
    .flatMap((layer) => layer.objects)
    .filter(
      (object) =>
        !(covering && object.type === "roof_plane") &&
        !object.type.startsWith("house_") &&
        !object.type.startsWith("reference_") &&
        (object.type !== "roof_flashing" ||
          object.metadata?.representativeGableRidge),
    );
  return (
    <>
      {lighting && <PergolaLightFixtures />}
      {blindWorkspace && (
        <PreviewBlinds
          workspace={
            onSelect && !interactiveChoices
              ? { ...blindWorkspace, editing: false, select: onSelect }
              : lighting?.editing || choiceView === "lighting"
                ? { ...blindWorkspace, editing: false, select: noop }
                : choiceView === "sides" && !interactiveChoices
                  ? { ...blindWorkspace, select: noop }
                  : blindWorkspace
          }
        />
      )}
      {covering && (
        <PreviewRoofFinish
          covering={covering}
          review={studio && reviewSetting}
        />
      )}
      <StructuralFinish enabled={enhanced} objects={objects}>
        {objects.map((object) =>
          object.type === "roof_plane" ||
          object.type === "roof_cladding_panel" ? (
            <PreviewRoof key={object.id} object={object} />
          ) : (
            <SceneObjectNode
              key={object.id}
              object={object}
              color={
                frameAppearance(lighting?.roof.frameFinish) ??
                (enhanced ? "#303330" : realism ? "#303631" : "#242824")
              }
              memberAppearance={{
                roughness: realism ? 0.46 : studio ? 0.28 : 0.38,
                metalness: realism ? 0.16 : studio ? 0.35 : 0.2,
                envMapIntensity: realism ? 0.95 : studio ? 1.1 : 0.8,
              }}
              selected={selected}
              hovered={false}
              onSelect={onSelect ?? noop}
              onHoverEnter={noop}
              onHoverLeave={noop}
              onFocus={noop}
              clippingPlanes={[]}
            />
          ),
        )}
      </StructuralFinish>
    </>
  );
}
