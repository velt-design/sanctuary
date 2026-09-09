import type { Assembly3D } from './contracts';
import { buildPlanViewModel } from './plan';
import { buildViewerSceneModel } from './viewer';
import { boxGutterProfile, boxMember } from './representativeBoxMembers';
import { representativeBoxRules } from './representativeBoxRules';
import { addRepresentativeBoxRoof } from './representativeBoxRoof';

export type RepresentativeBoxOptions = {widthMm:number;projectionMm:number;connection:'facade'|'soffit'};

/** Isolated level-box concept; no authored solve, quantity takeoff or price claim. */
export function buildRepresentativeBox({widthMm:width,projectionMm:projection,connection}:RepresentativeBoxOptions) {
  if (connection !== 'facade' && connection !== 'soffit') throw new Error('Box attachment must be facade or soffit');
  if (connection === 'soffit' && projection > 4000) throw new Error('Soffit projection exceeds 4m');
  const rules=representativeBoxRules(width,projection), z=rules.bottomZ+150;
  const outline=[{x:0,y:0,z:0},{x:width,y:0,z:0},{x:width,y:projection,z:0},{x:0,y:projection,z:0}];
  const assembly:Assembly3D={family:'box',outline,attachmentEdge:{start:outline[0],end:outline[1]},house:{},
    datum:{origin:outline[0],xAxis:{x:1,y:0,z:0},yAxis:{x:0,y:1,z:0},zAxis:{x:0,y:0,z:1},attachmentEdgeStart:outline[0],attachmentEdgeEnd:outline[1]},
    members:[],roofPlanes:[],roofCladdingPanels:[],supportConditions:[],quantityHooks:[],
    semantics:{connectionType:connection==='facade'?'wall':'soffit',roofType:'box',structuralZones:['level_box','inset_roof']}};
  assembly.members.push(
    boxMember('box-rear','ledger',{x:0,y:25,z},{x:width,y:25,z},'300x50'),
    boxMember('box-front','beam',{x:0,y:projection-25,z},{x:width,y:projection-25,z},'300x50'),
    boxMember('box-left','beam',{x:25,y:50,z},{x:25,y:projection-50,z},'300x50'),
    boxMember('box-right','beam',{x:width-25,y:50,z},{x:width-25,y:projection-50,z},'300x50'));
  for (const y of rules.roofMode==='gable'?[100,projection-100]:[projection-100])
    assembly.members.push(boxMember(`box-gutter-${y}`,'gutter',{x:50,y,z:rules.bottomZ+50},{x:width-50,y,z:rules.bottomZ+50},boxGutterProfile()));
  for(let i=0;i<rules.postCount;i++) {
    const x=rules.postSize/2+(width-rules.postSize)*i/(rules.postCount-1),y=projection-rules.postSize/2;
    assembly.members.push(boxMember(`box-post-${i}`,'post',{x,y,z:0},{x,y,z:rules.bottomZ},`${rules.postSize}x${rules.postSize}`,{x:0,y:1,z:0}));
  }
  addRepresentativeBoxRoof(assembly,width,projection,rules);
  return {assembly,plan:buildPlanViewModel(assembly),viewerScene:buildViewerSceneModel(assembly)};
}
