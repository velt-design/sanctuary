import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { studioAttachmentFixture } from '../../../../../test/studioAttachmentFixture';
import { previewStudioAttachment } from '@/lib/designStudio/studioHouseCommands';
import { createStudioSceneResolver } from '@/lib/designStudio/interaction/resolvedScene';
import WebsiteConnectionDetail from './WebsiteConnectionDetail';
const observed=vi.hoisted(()=>({colors:[] as string[]}));
vi.mock('@sp/configurator/react',()=>({ContextSectionMesh:({color}:any)=>{observed.colors.push(color);return null;}}));
let mount:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{mount?.unmount();mount=undefined;});
it.each([['white','#e8e7df'],['black','#242824']] as const)('colours every actual soffit bracket with the %s frame finish', (frameFinish,color)=>{
 const edit=previewStudioAttachment(studioAttachmentFixture(),{objectId:'p2',houseId:'house',edge:'rear',kind:'eave',method:'soffit'}),scene=createStudioSceneResolver().resolve(edit),p=scene.products[0];
 observed.colors=[];mount=renderIntoDocument(<WebsiteConnectionDetail house={scene.scene.houses[0]} side="rear" assembly={p.geometry!.assembly} pose={p.position!} widthMm={p.design!.input.widthMm} frameFinish={frameFinish}/>);
 expect(observed.colors.length).toBeGreaterThan(0);expect(new Set(observed.colors)).toEqual(new Set([color]));
});
