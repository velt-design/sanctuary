import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';

it('keeps private row presentation and record derivation out of the shared public frame dependency closure',()=>{
 const root=process.cwd();const config=ts.readConfigFile(path.join(root,'apps/portal/tsconfig.json'),ts.sys.readFile).config;
 const options=ts.parseJsonConfigFileContent(config,ts.sys,path.join(root,'apps/portal')).options;
 const seen=new Set<string>();
 const visit=(file:string)=>{
  file=path.resolve(file);if(seen.has(file)||!file.startsWith(path.join(root,'apps/portal'))||!/\.[jt]sx?$/.test(file))return;
  seen.add(file);const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of source.statements){
   if(!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node))continue;
   if(!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue;
   if(ts.isExportDeclaration(node)&&node.isTypeOnly)continue;
   if(ts.isImportDeclaration(node)){
    const clause=node.importClause;if(clause?.isTypeOnly)continue;
    if(clause&&!clause.name&&clause.namedBindings&&ts.isNamedImports(clause.namedBindings)&&clause.namedBindings.elements.every(e=>e.isTypeOnly))continue;
   }
   const resolved=ts.resolveModuleName(node.moduleSpecifier.text,file,options,ts.sys).resolvedModule;
   if(resolved&&!resolved.isExternalLibraryImport)visit(resolved.resolvedFileName);
  }
 };
 visit(path.join(root,'apps/portal/components/page-state/PortalActualFrames.tsx'));
 const actual=[...seen].map(file=>path.relative(root,file).replaceAll('\\','/'));
 for(const privateFile of [
  'apps/portal/app/staff/contacts/contactsRecordSlots.tsx',
  'apps/portal/app/staff/contacts/ContactsIndexClient.tsx',
  'apps/portal/app/staff/schedule/ScheduleCrewFilterPanel.tsx',
  'apps/portal/lib/format/portalDateTime.ts',
  'apps/portal/components/ui/foundation/FoundationPagination.tsx',
  'apps/portal/components/ui/listBanner/ListCountBanner.tsx',
  'apps/portal/components/layout/GlobalPortalSearchRead.tsx',
  'apps/portal/components/layout/GlobalPortalSearch.client.tsx',
  'apps/portal/components/layout/GuardedGlobalPortalSearch.tsx',
  'apps/portal/components/ui/foundation/index.ts',
  'apps/portal/components/ui/foundation/SelectionTable.tsx',
  'apps/portal/components/ui/foundation/DestructiveConfirmation.tsx',
  'apps/portal/components/ui/foundation/FoundationOperational.tsx',
  'apps/portal/components/ui/foundation/SanctuaryStatus.tsx',
  'apps/portal/lib/queries/portalSearch.ts',
  'apps/portal/app/dashboard/DashboardClient.tsx',
  'apps/portal/app/dashboard/_components/ProjectWorkQueueCard.tsx',
  'apps/portal/app/dashboard/_components/RecentActivityCard.tsx',
  'apps/portal/app/dashboard/_components/RecentEstimatesCard.tsx',
  'apps/portal/app/dashboard/_components/PipelineCountsCard.tsx',
  'apps/portal/app/dashboard/_components/DashboardTaskRows.tsx',
  'apps/portal/components/site-visits/TodayVisitsDetails.tsx',
  'apps/portal/lib/siteVisits/calendarModel.ts',
  'apps/portal/lib/dashboard/tasks.ts',
  'apps/portal/components/projects/workQueue/workQueueFilters.ts',
  'apps/portal/app/staff/projects/design-packages/useDesignListSpreadsheetAdapter.tsx',
  'apps/portal/app/staff/projects/running-jobs/useRunningJobsSpreadsheetAdapter.tsx',
 ])expect(actual,privateFile).not.toContain(privateFile);
 expect(actual).toContain('apps/portal/components/spreadsheet/SpreadsheetSurface.tsx');
 expect(actual).toContain('apps/portal/app/dashboard/_components/PipelineCountsSurface.tsx');
});
