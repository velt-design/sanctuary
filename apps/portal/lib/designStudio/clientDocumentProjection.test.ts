import {expect,it} from 'vitest';
import {previewWebsiteJoin} from './websiteJoins';
import {addWebsitePergola} from './websiteComposition';
import {studioDocumentTriangles} from '../../../../packages/studio-documents/src/mesh';
import {studioClientDocumentFixture} from '../../../../test/fixtures/studio-client-documents';
import {projectStudioClientDocument} from './clientDocumentProjection.server';
import {studioDocumentPages,parseStudioClientDocumentSource} from '@sp/studio-documents/contract';
import {studioDocumentHeightFacts} from '../../../../packages/studio-documents/src/facts';
it('freezes the full canonical two-product scene and derives separate Plan/iso inventory without inventing site or section facts',()=>{
 const edit=studioClientDocumentFixture(),before=structuredClone(edit);
 const source=projectStudioClientDocument(edit,{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'Synthetic courtyard',siteAddress:'12 Example Road, Auckland',issuedDate:'28 OCT 2026'});
 expect(parseStudioClientDocumentSource(source)).toEqual(source);expect(studioDocumentPages(source).map(p=>p.kind)).toEqual(['cover','plan','iso','plan','iso']);
 expect(source.products.map(p=>[p.widthMm,p.projectionMm,p.frameFinish])).toEqual([[6000,4000,'Black'],[4000,3000,'White']]);expect(source.houses).toHaveLength(1);
 for(const p of source.products){expect(p.assembly.members.length).toBeGreaterThan(0);for(const member of p.plan.members.posts)expect(p.assembly.members.find(m=>m.id===member.id)?.profile).toEqual(member.profile);}
 expect(source.products[0].covering?.regions.some(r=>r.material==='solid')).toBe(true);expect(source.products[0].covering?.regions.some(r=>r.material==='acrylic')).toBe(true);
 expect(source.products[0].roofMaterial).toContain('skylight');expect(source.products[0].extras.lights).toEqual([]);
 expect(studioDocumentHeightFacts(source.products[1]).eaves).toEqual([2600]);expect(studioDocumentHeightFacts(source.products[1]).ridgeTop).toBeGreaterThan(3300);
 expect(source).not.toHaveProperty('siteBoundary');expect(source).not.toHaveProperty('slabDatum');expect(source).not.toHaveProperty('windZone');expect(source).not.toHaveProperty('pricing');expect(edit).toEqual(before);
});

it('retains canonical join witnesses and both exact clipped member assemblies before isolating a pergola',()=>{
 const edit=studioClientDocumentFixture();edit.objectOptions[1].values.websiteDesign={...(structuredClone(edit.objectOptions[0].values.websiteDesign) as any),objectId:'p2'};edit.spatial.pergolas[1].family=edit.spatial.pergolas[0].family;
 const joined=previewWebsiteJoin(edit,{id:'join',a:{objectId:'p2',edge:'left'},b:{objectId:'p1',edge:'right'},alignment:'centre'}).edit;
 const source=projectStudioClientDocument(joined,{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'Synthetic joined pergolas',siteAddress:'12 Example Road',issuedDate:'28 OCT 2026'});
 expect(source.joins).toHaveLength(1);expect(source.joins[0].objectIds).toEqual(['p2','p1']);expect(source.joins[0].polygons[0].length).toBeGreaterThan(2);
 for(const product of source.products)expect(studioDocumentTriangles(product,source.joins).length).toBeGreaterThan(studioDocumentTriangles(product).length);
 expect(source.products[0].covering?.regions.some(r=>r.material==='acrylic')).toBe(true);expect(source.houses[0].model.roofFlashings?.length).toBeGreaterThan(0);
});
it('expands the register by a separate Plan and iso for each extra Box pergola rather than assuming a five-page booklet',()=>{
 const edit=addWebsitePergola(studioClientDocumentFixture(),'p3'),option=edit.objectOptions.find(o=>o.objectId==='p3')??edit.objectOptions[2];
 const design=option.values.websiteDesign as any;design.selection.roof.family='box';design.selection.roof.attachmentIntent='freestanding';edit.spatial.pergolas[2].family='box';
 const source=projectStudioClientDocument(edit,{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'Synthetic three pergolas',siteAddress:'12 Example Road',issuedDate:'28 OCT 2026'});
 expect(studioDocumentPages(source).map(p=>p.kind)).toEqual(['cover','plan','iso','plan','iso','plan','iso']);expect(source.products.map(p=>p.roofLabel)).toEqual(['Pitched','Gable','Box perimeter']);
});
