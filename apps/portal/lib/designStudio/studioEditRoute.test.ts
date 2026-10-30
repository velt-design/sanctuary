import {expect,it} from 'vitest';
import {studioEditCallback,studioEditQuery,studioDocumentCallback,studioReviewCallback} from './studioEditRoute';
import {stripInternalSearchParams} from 'next/dist/server/internal-utils';
const path='/staff/design-studio/proj_10000000-0000-4000-8000-000000000001/est_20000000-0000-4000-8000-000000000001/edit';
it.each(['','?intent=edit','?intent=revision','?intent=duplicate&name=Courtyard+east'])('accepts only supported canonical callback %s',search=>{
 expect(studioEditCallback(path+search,true)).toBe(path+search);
});
it.each([path.toUpperCase(),path.replace('proj_',''),path.replace('est_','proj_'),path+'/',path+'/more',path+'?intent=other',path+'?name=Name',path+'?intent=edit&intent=duplicate',path+'?intent=duplicate&name=a&name=b',path+'?unknown=x',path+'?__proto__=x',path+'?constructor=x',path+'#hash','//outside.invalid'+path,'https://outside.invalid'+path,path+'?intent=duplicate&name='+ 'x'.repeat(121),path+'?intent=duplicate&name=%5C'])('rejects unsupported/aliased callback %s',raw=>{
 expect(studioEditCallback(raw,true)).toBeNull();
});
it('keeps feature disabled and forged non-Studio routing hints out',()=>{
 expect(studioEditCallback(path,false)).toBeNull();expect(studioEditCallback('/staff/projects',true)).toBeNull();expect(studioEditCallback(null,true)).toBeNull();
});
it('matches the installed Next internal query stripping without broadening user query support',()=>{
 const raw=path+'?intent=duplicate&name=Courtyard&_rsc=framework-key';
 expect(studioEditCallback(raw,true)).toBe(path+'?intent=duplicate&name=Courtyard');
 expect(new URL(stripInternalSearchParams('https://local.invalid'+raw) as string).searchParams.has('_rsc')).toBe(false);
 expect(studioEditCallback(raw+'&unknown=x',true)).toBeNull();
});
it('retains page query validation and normalization without excluding supported names from the actual editor',()=>{
 expect(studioEditQuery({intent:'duplicate',name:'  Courtyard   east  '})).toMatchObject({intent:'duplicate',duplicateName:'Courtyard east'});
 expect(studioEditQuery({intent:'duplicate',name:'Back\\garden'})).toMatchObject({duplicateName:'Back\\garden'});
 expect(studioEditQuery({intent:['edit']})).toBeNull();expect(studioEditQuery({name:'x'})).toBeNull();expect(studioEditQuery({unknown:undefined})).toBeNull();
 expect(studioEditCallback(path+'?name=Courtyard%20east&intent=duplicate',true)).toBe(path+'?intent=duplicate&name=Courtyard+east');
});

const review=path.replace('/edit',''),quote='qv_30000000-0000-4000-8000-000000000001';
it.each(['',`?quoteVersionId=${quote}`])('classifies exact Review/quote as public presentation only: %s',query=>{
 expect(studioReviewCallback(review+query,true)).toBe(review+query);expect(studioDocumentCallback(review+query,true)).toBe(review+query);
 expect(studioEditCallback(review+query,true)).toBeNull();expect(studioDocumentCallback(review+query,false)).toBeNull();
 expect(studioReviewCallback(review+query+(query?'&':'?')+'_rsc=framework',true)).toBe(review+query);
});
it.each([review.toUpperCase(),review+'/',review+'?quoteVersionId=',review+'?quoteVersionId=raw',review+`?quoteVersionId=${quote}&quoteVersionId=${quote}`,review+'?studioView=protected',review+'?unknown=x',review+'?intent=edit',review+'#quote',review.replace('proj_','')])('keeps Review fallback protected: %s',value=>{
 expect(studioReviewCallback(value,true)).toBeNull();expect(studioDocumentCallback(value,true)).toBeNull();
});
