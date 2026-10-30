import {pergolaLightSites} from '@sp/geometry';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {websiteComposition} from '@/lib/designStudio/websiteComposition';
import {defaultBlind,defaultSidePanel,DEFAULT_ROOF_BATTENS,DEFAULT_LIGHTING,effectiveLightingLayout,cedarSections} from '@sp/configurator/website';
import { expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import { addWebsitePergola } from '@/lib/designStudio/websiteComposition';
import StudioDesignSpecification from './StudioDesignSpecification';
import {applyStudioHouseEdit} from '@/lib/designStudio/houseEditing';

it('renders every product’s resolved dimensions, material, support and selected accessories together',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'summary-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 edit=addWebsitePergola(addWebsitePergola(edit,'a'),'b');
 const b=edit.objectOptions[1].values.websiteDesign as any;b.rawDimensions.widthMm='6500';b.selection.roof.family='gable';b.selection.roof.frameFinish='white';b.selection.roof.attachmentIntent='freestanding';b.selection.roof.blinds=[{...defaultBlind('front-1of2'),cover:'PELMET'}];b.selection.roof.sidePanels=[defaultSidePanel('left-1of1','aluminium')];b.selection.roof.roofBattens={...DEFAULT_ROOF_BATTENS};
 const m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);
 const articles=[...m.container.querySelectorAll('article')];expect(articles).toHaveLength(2);
 expect(articles[0].textContent).toContain('6,000 × 3,000 mm');expect(articles[0].textContent).toContain('House connection planned');
 expect(articles[1].textContent).toContain('6,500 × 3,000 mm');expect(articles[1].textContent).toContain('White aluminium');expect(articles[1].textContent).toContain('Freestanding');
 expect(articles[0].textContent).toContain('Open sides');expect(articles[0].textContent).toContain('None selected');expect(articles[1].textContent).toContain('Shadeview Urban');expect(articles[1].textContent).toContain('Flashing + inside pelmet');expect(articles[1].textContent).toContain('aluminium slats');m.unmount();
});

it('summarises effective placed lighting instead of retained stale count fields',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'light-summary',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};edit=addWebsitePergola(edit,'p');
 const value=edit.objectOptions[0].values.websiteDesign as any;value.selection.roof.lighting={...DEFAULT_LIGHTING,rafterCount:199,rafterAmount:'medium'};
 const row=websiteComposition(edit)[0],g=solvePergolaPreview(row.design!.input,row.design!.roof,row.geometryOptions).geometry,expected=effectiveLightingLayout(pergolaLightSites(g!.assembly,g!.covering),row.design!.roof.lighting!).selection;
 const m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);expect(expected.rafterCount).toBeGreaterThan(0);expect(expected.rafterCount).not.toBe(199);expect(m.container.textContent).toContain(expected.rafterCount+' rafter spots');expect(m.container.textContent).not.toContain('199 rafter spots');expect(value.selection.roof.lighting.rafterCount).toBe(199);m.unmount();
});

it('distinguishes dormant side and gable choices from the current rendered shape',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'dormant-summary',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};edit=addWebsitePergola(edit,'p');
 const value=edit.objectOptions[0].values.websiteDesign as any;value.selection.roof.infills=true;value.selection.roof.blinds=[defaultBlind('front-1of9')];
 const m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);expect(m.container.textContent).toContain('1 retained side selection(s)');expect(m.container.textContent).not.toContain('Gable infills');expect(m.container.textContent).not.toContain('Shadeview Urban');m.unmount();
});

it('shows rear fixed sides and blinds as current accessories rather than retained unavailable choices',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'rear-summary',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};edit=addWebsitePergola(edit,'p');
 const value=edit.objectOptions[0].values.websiteDesign as any;value.selection.roof.family='box';value.selection.roof.attachmentIntent='freestanding';value.selection.roof.sidePanels=[defaultSidePanel('rear-1of2','aluminium')];value.selection.roof.blinds=[defaultBlind('rear-2of2')];
 const m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);
 expect(m.container.textContent).toContain('Rear 1: vertical aluminium slats');expect(m.container.textContent).toContain('Rear 2: Shadeview Urban');expect(m.container.textContent).not.toContain('retained side selection');m.unmount();
});
it('shows authored house appearance in Review as context without claiming a supplier colour or price',()=>{
 const empty:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'house-spec',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const added=applyStudioHouseEdit(empty.spatial,{kind:'add',id:'house'});if(!added.ok)throw Error(added.message);
 const styled=applyStudioHouseEdit(added.spatial,{kind:'appearance',houseFormId:'house',patch:{wallMaterial:'brick',roofProfile:'tray',roofTrayWidth:300,roofColour:'#ABCDEF'}});if(!styled.ok)throw Error(styled.message);
 const edit={...empty,spatial:styled.spatial},before=structuredClone(edit),m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);
 expect(m.container.textContent).toContain('Brick walls · Tray 300 mm steel roof · #ABCDEF');expect(m.container.textContent).toContain('excluded from the pergola price');expect(edit).toEqual(before);m.unmount();
});

it('shows canonical zero when every valid ceiling section is explicitly turned off',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'zero-light-summary',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};edit=addWebsitePergola(edit,'p');
 const value=edit.objectOptions[0].values.websiteDesign as any;value.rawDimensions={widthMm:'5600',projectionMm:'3000'};value.selection.roof.finish={material:'solid',profile:'corrugated',trayWidth:400,ceiling:'cedar-100',layout:'central',acrylicBays:2};value.selection.roof.lighting={...DEFAULT_LIGHTING,cedarPerSection:4,cedarPattern:'rows2'};
 const row=websiteComposition(edit)[0],g=solvePergolaPreview(row.design!.input,row.design!.roof,row.geometryOptions).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
 expect(effectiveLightingLayout(sites,row.design!.roof.lighting!).cedar).toHaveLength(4);
 value.selection.roof.lighting.cedarIndividual=true;value.selection.roof.lighting.cedarOverrides=Object.fromEntries(cedarSections(sites.cedar).map(section=>[section,{count:0,pattern:'rows2'}]));
 const before=structuredClone(edit),m=renderIntoDocument(<StudioDesignSpecification edit={edit}/>);
 expect(m.container.textContent).toContain('0 ceiling downlights');expect(m.container.textContent).not.toContain('4 ceiling downlights per section');expect(edit).toEqual(before);m.unmount();
});
