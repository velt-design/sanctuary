import {it,expect} from 'vitest';
import {solvePergolaPreview} from './solvePreview';
import {INITIAL_INPUT} from './model';
import {INITIAL_ROOF,type PreviewRoofChoices} from './GableChoices';
import {DEFAULT_ROOF_BATTENS,parseRoofBattens} from './roofBattenSelection';
import {parsePreviewDraft} from './previewDraft';
import {serializePreviewDesign,parsePreviewDesign} from './previewShare';
import {buildContactDesignBrief} from '../../app/contact/contactDesignBrief';
for(const family of ['mono','gable','box'] as const)for(const orientation of ['parallel','away'] as const)for(const material of ['acrylic','combination'] as const)it(family+' '+orientation+' '+material+' battens follow acrylic roof areas',()=>{
  const roof:PreviewRoofChoices={...INITIAL_ROOF,family,orientation,roofBattens:DEFAULT_ROOF_BATTENS,finish:{material,profile:'corrugated',trayWidth:400,layout:'central',acrylicBays:2}};
  const g=solvePergolaPreview({...INITIAL_INPUT,connection:'facade',projectionMm:3000},roof).geometry!;
  expect(g).toBeDefined();const covering=g.covering!;
  expect(covering.battenBoundaries!.length).toBeGreaterThan(10);
  for(const mesh of covering.meshes.filter(m=>m.id.startsWith('roof-battens'))){expect(mesh.positions.every(Number.isFinite)).toBe(true);expect(mesh.indices.length).toBeGreaterThan(0);}
  if(material==='combination')for(const boundary of covering.battenBoundaries!){
    expect(covering.regions.filter(r=>r.material==='acrylic').some(r=>boundary.every(p=>p.x>=Math.min(...r.boundary.map(p=>p.x))-200&&p.x<=Math.max(...r.boundary.map(p=>p.x))+200&&p.y>=Math.min(...r.boundary.map(p=>p.y))-200&&p.y<=Math.max(...r.boundary.map(p=>p.y))+200))).toBe(true);
  }
  if(family==='box')for(const boundary of covering.battenBoundaries!)for(const p of boundary){expect(p.x).toBeGreaterThanOrEqual(50);expect(p.x).toBeLessThanOrEqual(INITIAL_INPUT.widthMm-50);}
});
it('changes batten section, keeps exact gaps and seats timber against rafter undersides',()=>{
  const input={...INITIAL_INPUT,projectionMm:3200};
  for(const edge of [false,true]){
    const roof={...INITIAL_ROOF,roofBattens:{...DEFAULT_ROOF_BATTENS,profile:'65x39' as const,edge,gap:80}};
    const g=solvePergolaPreview(input,roof).geometry!,points=g.covering!.battenBoundaries!;
    const n=g.assembly.roofPlanes[0].plane.normal,fall=g.assembly.roofPlanes[0].fallVector;
    const len=Math.hypot(fall.x,fall.y,fall.z),v={x:fall.x/len,y:fall.y/len,z:fall.z/len};
    const dot=(p:{x:number;y:number;z:number},a:typeof n)=>p.x*a.x+p.y*a.y+p.z*a.z;
    const span=(p:typeof points[number])=>Math.max(...p.map(p=>dot(p,v)))-Math.min(...p.map(p=>dot(p,v)));
    expect(span(points[0])).toBeCloseTo(edge?39:65);
    expect(Math.min(...points[1].map(p=>dot(p,v)))-Math.max(...points[0].map(p=>dot(p,v)))).toBeCloseTo(80);
    const m=g.covering!.meshes[0],zs=[];for(let i=0;i<m.positions.length;i+=3)zs.push(dot({x:m.positions[i],y:m.positions[i+1],z:m.positions[i+2]},n));
    expect(Math.max(...zs)-Math.min(...zs)).toBeCloseTo(edge?65:39);
  }
});
it('round-trips defaults and custom spacing through drafts, links and enquiry',()=>{
  const roof={...INITIAL_ROOF,roofBattens:{...DEFAULT_ROOF_BATTENS,profile:'65x39' as const,edge:true}};
  const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof})!;
  expect(draft.roof.roofBattens!.gap).toBe(80);
  expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
  expect(parseRoofBattens({...roof.roofBattens,gap:27,customGap:true})!.gap).toBe(27);
  expect(parseRoofBattens({...roof.roofBattens,gap:-1})).toBeNull();
  const brief=buildContactDesignBrief({...draft,result:null});expect(brief.description).toContain('80 mm clear gap');expect(brief.estimate).toBeNull();
  expect(parsePreviewDraft({...draft,roof:{...roof,finish:{material:'solid',profile:'tray',trayWidth:400,layout:'central',acrylicBays:2}}})!.roof.roofBattens).toBeUndefined();
});
