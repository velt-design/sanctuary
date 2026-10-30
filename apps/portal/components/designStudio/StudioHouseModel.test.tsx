import { afterEach, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../test/reactHarness";
import { studioAttachmentFixture } from "../../../../test/studioAttachmentFixture";
import { createStudioSceneResolver } from "@/lib/designStudio/interaction/resolvedScene";
import {
  positionWebsitePergola,
  websiteComposition,
} from "@/lib/designStudio/websiteComposition";
import { changeStudioProduct } from "@/lib/designStudio/studioHouseCommands";
import StudioHouseModel from "./StudioHouseModel";
const host = vi.hoisted(() => ({ renders: 0, props: null as any }));
vi.mock("@sp/geometry-viewer/react/canvas", () => ({
  SceneCanvas: (props: any) => {
    host.renders++;
    host.props = props;
    return null;
  },
}));
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
});
function nodes(node: any, name: string): any[] {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child, name));
  if (!node || typeof node !== "object") return [];
  return [
    ...(node.type?.name === name ? [node] : []),
    ...nodes(node.props?.children, name),
  ];
}
it("defers hidden Studio scene rebuilding and reveals current options, pending/invalid presentation and callbacks without replacing camera intent", () => {
  host.renders = 0;
  const resolver = createStudioSceneResolver(),
    edit = studioAttachmentFixture(),
    first = resolver.resolve(edit);
  const value = websiteComposition(edit)[0].value!;
  const pending = changeStudioProduct(
    positionWebsitePergola(edit, "p2", {
      originXMm: "16000",
      originYMm: "8000",
      rotationDeg: "37",
    }),
    {
      ...value,
      selection: {
        ...value.selection,
        roof: { ...value.selection.roof, frameFinish: "white" },
      },
    },
  );
  const invalid = structuredClone(pending);
  invalid.spatial.houseAssembly!.houseForms[0].wallHeightM = "bad";
  const current = resolver.resolve(invalid),
    oldSelect = vi.fn(),
    latestSelect = vi.fn();
  const props = {
    scene: first,
    active: true,
    selected: "p2",
    onSelect: oldSelect,
    readOnly: false,
    section: "Sides",
    refinedHouse: true,
    persistentViewport: true,
    cameraStorageKey: "same-model",
    zoomStep: 2,
    fit: 0,
    framingKey: edit.designId,
    focused: null,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 10000, y: 10000, z: 4000 },
    ],
    onVisibility: vi.fn(),
    isNight: false,
  };
  mounted = renderIntoDocument(<StudioHouseModel {...props} />);
  const initialRenders = host.renders;
  mounted.rerender(<StudioHouseModel {...props} />);
  expect(host.renders).toBe(initialRenders);
  mounted.rerender(<StudioHouseModel {...props} active={false} />);
  const paused = host.renders;
  expect(paused).toBeGreaterThan(initialRenders);
  mounted.rerender(
    <StudioHouseModel
      {...props}
      active={false}
      scene={resolver.resolve(pending)}
    />,
  );
  mounted.rerender(
    <StudioHouseModel
      {...props}
      active={false}
      scene={current}
      onSelect={latestSelect}
      section="Lighting"
    />,
  );
  expect(host.renders).toBe(paused);
  mounted.rerender(
    <StudioHouseModel
      {...props}
      scene={current}
      onSelect={latestSelect}
      section="Lighting"
    />,
  );
  expect(host.renders).toBe(paused + 1);
  expect(host.props.active).toBe(true);
  const contexts = nodes(host.props.children, "StudioProductContext");
  expect(contexts[0].props.row).toBe(current.products[0]);
  expect(current.houseRecords[0].error).toBeTruthy();
  expect(nodes(host.props.children, "WebsiteConnectionDetail")).toHaveLength(0);
  const product = contexts[0].props.children;
  product.props.onClick({ stopPropagation() {} });
  expect(oldSelect).not.toHaveBeenCalled();
  expect(latestSelect).toHaveBeenCalledWith("p2");
  const camera = nodes(host.props.children, "PreviewCamera")[0].props;
  expect(camera).toMatchObject({
    preserveUserCamera: true,
    storageKey: "same-model:3d",
    fit: 0,
    reset: 0,
    zoomStep: 2,
  });
  expect(
    nodes(host.props.children, "PreviewProductNode")[0].props.choiceView,
  ).toBe("lighting");
  expect(contexts[0].props.row.design.roof.frameFinish).toBe("white");
  const productNode = nodes(host.props.children, "PreviewProductNode")[0];
  expect(productNode.props.interactiveChoices).toBe(true);
  productNode.props.onSelect();
  expect(latestSelect).toHaveBeenLastCalledWith("p2");
  expect(oldSelect).not.toHaveBeenCalled();
  mounted.rerender(<StudioHouseModel {...props} selected="another" readOnly />);
  expect(
    nodes(host.props.children, "StudioProductContext")[0].props.active,
  ).toBe(false);
  expect(
    nodes(host.props.children, "PreviewProductNode")[0].props
      .interactiveChoices,
  ).toBe(false);
});

it("reconciles the editor grid through the real explicit catalogue and disposes its owned resources on removal", async()=>{
  const {createRoot,act:actScene}=await import('@react-three/fiber');
  const {registerSceneCatalogue}=await import('../../../../packages/geometry-viewer/src/react/canvas/sceneCatalogue');
  const {WebGLCoordinateSystem}=await import('three');
  const edit=studioAttachmentFixture(),scene=createStudioSceneResolver().resolve(edit);
  const props={cad:true,active:true,scene,selected:'p2',onSelect:vi.fn(),readOnly:false,section:'Shape',refinedHouse:true,persistentViewport:true,cameraStorageKey:'grid-test',zoomStep:0,fit:0,framingKey:edit.designId,focused:null,points:[{x:0,y:0,z:0},{x:10000,y:10000,z:4000}],onVisibility:vi.fn(),isNight:false};
  mounted=renderIntoDocument(<StudioHouseModel {...props}/>);
  function findGrid(node:any):any{if(Array.isArray(node))return node.map(findGrid).find(Boolean);if(!node||typeof node!=='object')return null;return node.type==='gridHelper'||(node.type==='primitive'&&node.props.object?.type==='GridHelper')?node:findGrid(node.props?.children);}
  const gridNode=findGrid(host.props.children);expect(gridNode).toBeTruthy();
  const canvas=document.createElement('canvas');
  const gl={domElement:canvas,render:vi.fn(),setSize:vi.fn(),setPixelRatio:vi.fn(),getPixelRatio:()=>1,shadowMap:{enabled:false,type:0},renderLists:{dispose:vi.fn()},forceContextLoss:vi.fn(),coordinateSystem:WebGLCoordinateSystem,xr:{enabled:false,isPresenting:false,addEventListener:vi.fn(),removeEventListener:vi.fn(),setAnimationLoop:vi.fn()}};
  registerSceneCatalogue();const root=createRoot(canvas);await root.configure({gl:gl as any,frameloop:'never',size:{width:640,height:480,top:0,left:0}});
  try{
    await actScene(async()=>{root.render(gridNode);});
    const state=root.render(gridNode).getState(),grid=state.scene.children.find(child=>child.type==='GridHelper') as any;
    expect(grid).toBeTruthy();expect(grid.geometry.attributes.position.count).toBeGreaterThan(0);
    const geometry=vi.spyOn(grid.geometry,'dispose'),material=vi.spyOn(grid.material,'dispose');
    await actScene(async()=>{root.render(null);});
    expect(geometry).not.toHaveBeenCalled();expect(material).not.toHaveBeenCalled();
    mounted.unmount();mounted=undefined;
    expect(geometry).toHaveBeenCalledTimes(1);expect(material).toHaveBeenCalledTimes(1);
  }finally{await actScene(async()=>{root.unmount();});}
});
