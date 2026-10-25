import {expect,it,vi} from 'vitest';
const boundary=vi.hoisted(()=>({contact:vi.fn(),api:vi.fn(),activity:vi.fn(),write:vi.fn()}));
vi.mock('./contactsRepo',()=>({getContact:boundary.contact}));
vi.mock('./projectsRepo',()=>({getProject:async()=>({id:'project',contactId:'contact'}),addProjectActivity:boundary.activity}));
vi.mock('./estimatesRepo',()=>({getEstimate:async()=>({id:'estimate',projectId:'project'})}));
vi.mock('./apiClient',()=>({apiJson:boundary.api}));
vi.mock('./storage',()=>({readJson:()=>[],writeJson:boundary.write}));
vi.mock('./migrations',()=>({ensureQuotesMigration:()=>{}}));
it('propagates contact read failures before creating or caching any quote',async()=>{
 const failure=new Error('Contact source unavailable');boundary.contact.mockRejectedValueOnce(failure);
 const {createQuoteFromEstimate}=await import('./quotesRepo');
 await expect(createQuoteFromEstimate('project','estimate')).rejects.toBe(failure);
 expect(boundary.api).not.toHaveBeenCalled();expect(boundary.write).not.toHaveBeenCalled();expect(boundary.activity).not.toHaveBeenCalled();
});
