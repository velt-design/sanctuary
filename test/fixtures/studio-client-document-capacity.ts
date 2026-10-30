import {websiteComposition} from '../../apps/portal/lib/designStudio/websiteComposition';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {representativeBlindOpenings,pergolaLightSites} from '@sp/geometry';
import {defaultSidePanel,defaultBlind,DEFAULT_LIGHTING} from '@sp/configurator/website';
import {studioClientDocumentFixture} from './studio-client-documents';
import {projectStudioClientDocument} from '../../apps/portal/lib/designStudio/clientDocumentProjection.server';
/** Renderer capacity fixture, not a saved customer job or a pricing proof. */
export function studioDocumentCapacityFixture(){
 const source=projectStudioClientDocument(studioClientDocumentFixture(),{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'CapacityProject'+ 'W'.repeat(265),siteAddress:'12 Example Road',issuedDate:'28 OCT 2026',issuedAt:'2026-10-28T00:00:00Z'});
 const base=source.products[0];source.products=Array.from({length:32},(_,i)=>{const product=structuredClone(base),prefix=`Pergola${i+1}`;return{...product,id:`p${i+1}`,code:`P${String(i+1).padStart(2,'0')}`,label:prefix+'W'.repeat(200-prefix.length),pose:{x:(i%8)*7000,y:Math.floor(i/8)*5500,rotation:0}};});return source;
}

/** All canonical available openings and selected lighting exercise real option
 * descriptions/geometry through the existing producer, not invented PDF facts. */
export function studioDocumentSelectionsFixture(){
 const edit=studioClientDocumentFixture(),row=websiteComposition(edit)[0];if(!row.design)throw Error('Fixture design unavailable');
 const geometry=solvePergolaPreview(row.design.input,row.design.roof,row.geometryOptions).geometry!;
 const openings=representativeBlindOpenings(geometry.assembly,{...row.geometryOptions,rearOpenings:true}),roof=(edit.objectOptions[0].values.websiteDesign as any).selection.roof;
 roof.sidePanels=openings.map(opening=>defaultSidePanel(opening.id,'timber'));
 roof.blinds=openings.map(opening=>({...defaultBlind(opening.id),cover:'PELMET',infill:true}));
 const strip=pergolaLightSites(geometry.assembly,geometry.covering).strips.find(s=>s.perimeter);
 roof.lighting={...DEFAULT_LIGHTING,rafterAmount:'medium',strips:strip?[strip.id]:[]};
 return projectStudioClientDocument(edit,{designVersionLabel:'V2',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),projectName:'Synthetic complete selections',siteAddress:'12 Example Road',issuedDate:'28 OCT 2026',issuedAt:'2026-10-28T00:00:00Z'});
}
