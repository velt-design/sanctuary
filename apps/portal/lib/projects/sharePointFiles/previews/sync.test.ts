// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanupProjectPreviews,reconcileProjectPreviews} from './sync';
import {GET} from '@/app/api/integrations/sharepoint-project-previews/route';
import {ProjectFilesError} from '../types';
const h=vi.hoisted(()=>({repository:vi.fn(),graph:vi.fn(),prepare:vi.fn(),config:vi.fn()}));
vi.mock('./repository',()=>({previewRepository:h.repository}));
vi.mock('../graph',()=>({createGraph:h.graph}));
vi.mock('../config',()=>({sharePointConfig:h.config}));
vi.mock('./cache',()=>({prepareCachedPreview:h.prepare}));
const claim={claimed:true,projectId:'11111111-1111-4111-8111-111111111111',rootId:'22222222-2222-4222-8222-222222222222',itemId:'root',folderId:'folder',cursor:null,lease:'33333333-3333-4333-8333-333333333333',generation:'44444444-4444-4444-8444-444444444444'};
let command:ReturnType<typeof vi.fn>,remove:ReturnType<typeof vi.fn>,children:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('CRON_SECRET','s'.repeat(32));vi.stubEnv('SANCTUARY_SHAREPOINT_ENABLED','true');vi.stubEnv('SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED','true');
 command=vi.fn(async(action:string)=>action==='cleanup'?{paths:[]}:action==='claim'?claim:{prepare:['file','second']});remove=vi.fn();children=vi.fn(async()=>({items:['file','second'].map(id=>({id,name:id+'.pdf',size:3,eTag:'"v1"',file:{mimeType:'application/pdf'}})),cursor:null}));
 h.repository.mockReturnValue({command,remove});h.config.mockReturnValue({binding:'binding'});h.graph.mockResolvedValue({children});h.prepare.mockResolvedValue({found:true});
});
afterEach(()=>vi.unstubAllEnvs());
it('owns one leased folder page and at most two preparations after current Graph containment',async()=>{
 expect(await reconcileProjectPreviews('assertion',new AbortController().signal)).toEqual({updated:true,prepared:2,removed:0,more:false});
 expect(h.graph).toHaveBeenCalledOnce();expect(children).toHaveBeenCalledWith('root','folder',undefined);expect(h.prepare).toHaveBeenCalledTimes(2);
 expect(command.mock.calls.map(call=>call[0])).toEqual(['cleanup','claim','reconcile']);
});
it('invalidates the claimed folder on source denial and never prepares its old bytes',async()=>{
 children.mockRejectedValue(new ProjectFilesError('access_required'));
 await expect(reconcileProjectPreviews('assertion',new AbortController().signal)).rejects.toThrow('access_required');
 expect(h.prepare).not.toHaveBeenCalled();expect(command).toHaveBeenCalledWith('fail',{folderId:'folder',lease:claim.lease,invalidate:true});
});
it('retains good variants on transient listing errors and continues after one corrupt new representation',async()=>{
 children.mockRejectedValueOnce(new ProjectFilesError('source_unavailable'));
 await expect(reconcileProjectPreviews('assertion',new AbortController().signal)).rejects.toThrow();
 expect(command).toHaveBeenCalledWith('fail',{folderId:'folder',lease:claim.lease,invalidate:false});
 h.prepare.mockRejectedValueOnce(new ProjectFilesError('source_invalid'));
 expect(await reconcileProjectPreviews('assertion',new AbortController().signal)).toMatchObject({prepared:1});
 expect(h.prepare).toHaveBeenCalledTimes(2);
});
it('does not acknowledge failed object deletion and keeps cleanup available while both feature switches are off',async()=>{
 command.mockImplementation(async(action:string)=>action==='cleanup'?{paths:['private-object']}:{completed:true});remove.mockRejectedValueOnce(new Error('Storage unavailable'));
 await expect(cleanupProjectPreviews(new AbortController().signal)).rejects.toThrow();expect(command.mock.calls.some(call=>call[0]==='cleaned')).toBe(false);
 vi.stubEnv('SANCTUARY_SHAREPOINT_ENABLED','false');vi.stubEnv('SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED','false');
 const response=await GET(new Request('http://local/api/integrations/sharepoint-project-previews',{headers:{authorization:'Bearer '+'s'.repeat(32)}}));
 expect(response.status).toBe(200);expect(await response.json()).toEqual({enabled:false,removed:1});expect(h.graph).not.toHaveBeenCalled();expect(command).toHaveBeenCalledWith('cleaned',{paths:['private-object']});
});
it('rejects missing cron identity before any Storage or source access',async()=>{
 expect((await GET(new Request('http://local/api/integrations/sharepoint-project-previews'))).status).toBe(401);expect(h.repository).not.toHaveBeenCalled();expect(h.graph).not.toHaveBeenCalled();
});
