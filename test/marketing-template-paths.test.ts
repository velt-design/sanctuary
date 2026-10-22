import {describe,it,expect} from 'vitest';
import path from 'node:path';
// @ts-expect-error Build helper has no declaration file.
import {canonicalTemplateFiles} from '../scripts/marketing/landing-template-paths.mjs';
describe('platform-independent landing template identity',()=>{
 it('deduplicates mixed Windows directory-import suffixes with identical source',()=>{
  const files=new Map([['C:\\repo\\packages\\core\\index.ts','same\r\n'],['C:\\repo\\packages\\core/index.ts','same\n']]);
  expect([...canonicalTemplateFiles('C:\\repo',files,path.win32)]).toEqual([['packages/core/index.ts','same\n']]);
 });
 it('matches the single Linux identity and normalizes dot segments',()=>{
  const win=canonicalTemplateFiles('C:/repo',new Map([['C:/repo/packages/core/../core/index.ts','same']]),path.win32);
  const linux=canonicalTemplateFiles('/repo',new Map([['/repo/packages/core/index.ts','same']]),path.posix);
  expect([...win]).toEqual([...linux]);
 });
 it('fails conflicting duplicate aliases rather than dropping a source change',()=>{
  expect(()=>canonicalTemplateFiles('C:/repo',new Map([['C:/repo/core/index.ts','before'],['C:\\repo\\core\\index.ts','after']]),path.win32)).toThrow('Conflicting');
 });
 it('rejects outside-root source entries',()=>{expect(()=>canonicalTemplateFiles('/repo',new Map([['/other/file.ts','source']]),path.posix)).toThrow('outside');});
});
