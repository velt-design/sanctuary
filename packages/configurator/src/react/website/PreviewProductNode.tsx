'use client';
import {frameAppearance} from './productAppearance';
import { SceneObjectNode } from '@sp/geometry-viewer/react';
import type { ViewerSceneModel, RoofFinishGeometry } from '@sp/geometry';
import PreviewBlinds from './PreviewBlinds';
import PreviewRoof from './PreviewRoof';
import PreviewRoofFinish from './PreviewRoofFinish';
import PergolaLightFixtures from './PergolaLightFixtures';
import { useLighting } from './LightingProvider';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { useSceneRenderingUpgrade } from './SceneRenderingUpgrade';
import { useRealismStudy } from './RealismStudy';
import StructuralFinish from './StructuralFinish';
const noop=()=>{};
/** The website's actual product subtree, reusable inside one composition Canvas. */
export default function PreviewProductNode({scene,covering,choiceView,reviewSetting=false,selected=false}:{scene:ViewerSceneModel;covering?:RoofFinishGeometry;choiceView?:'sides'|'lighting';reviewSetting?:boolean;selected?:boolean}){
 const enhanced=useSceneRenderingUpgrade(),realism=useRealismStudy();
 const studio=true,lighting=useLighting(),blindWorkspace=usePreviewBlinds();
 const objects=scene.layers.filter(layer=>layer.visibleByDefault).flatMap(layer=>layer.objects).filter(object=>!(covering&&object.type==='roof_plane')&&!object.type.startsWith('house_')&&!object.type.startsWith('reference_')&&(object.type!=='roof_flashing'||object.metadata?.representativeGableRidge));
 return <>
      {lighting&&<PergolaLightFixtures/>}
      {blindWorkspace && <PreviewBlinds workspace={lighting?.editing || choiceView === 'lighting'?{...blindWorkspace,editing:false,select:noop}:choiceView === 'sides'?{...blindWorkspace,select:noop}:blindWorkspace} />}
      {covering && <PreviewRoofFinish covering={covering} review={studio && reviewSetting} />}
      <StructuralFinish enabled={enhanced} objects={objects}>{objects.map((object) => object.type === 'roof_plane' || object.type === 'roof_cladding_panel'
        ? <PreviewRoof key={object.id} object={object} />
        : <SceneObjectNode key={object.id} object={object} color={frameAppearance(lighting?.roof.frameFinish)??(enhanced ? "#303330" : realism ? "#303631" : "#242824")} memberAppearance={{ roughness: realism ? .46 : studio ? .28 : .38, metalness: realism ? .16 : studio ? .35 : .2, envMapIntensity: realism ? .95 : studio ? 1.1 : .8 }}
          selected={selected} hovered={false} onSelect={noop} onHoverEnter={noop} onHoverLeave={noop} onFocus={noop} clippingPlanes={[]} />)}</StructuralFinish>
 </>;
}
