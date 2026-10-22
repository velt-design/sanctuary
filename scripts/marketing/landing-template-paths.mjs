import path from 'node:path';
/** Canonical repository-relative identity. Path spelling cannot duplicate a
 * reviewed source; conflicting aliases fail rather than selecting one silently. */
export function canonicalTemplateFiles(root, files, paths=path) {
 const canonical=new Map();
 for(const [file,source] of files){
  const key=paths.relative(paths.resolve(root),paths.resolve(file)).replaceAll('\\','/');
  if(!key||key==='..'||key.startsWith('../')||paths.isAbsolute(key))throw new Error('Template source outside repository');
  const normalized=source.replaceAll('\r\n','\n');
  if(canonical.has(key)&&canonical.get(key)!==normalized)throw new Error('Conflicting template file aliases');
  canonical.set(key,normalized);
 }
 return canonical;
}
