import {pergolaLightSites} from '@sp/geometry';
import {solvePergolaPreview} from '@sp/configurator/geometry';
import {websiteComposition} from '@/lib/designStudio/websiteComposition';
import {defaultBlind,defaultSidePanel,DEFAULT_ROOF_BATTENS,DEFAULT_LIGHTING,effectiveLightingLayout} from '@sp/configurator/website';
import { expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { StudioAuthoringEdit } from '@/lib/designStudio/authoringView';
import { addWebsitePergola } from '@/lib/designStudio/websiteComposition';
import StudioDesignSpecification from './StudioDesignSpecification';

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
