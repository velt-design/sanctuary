import { chromium, test, type Page } from '@playwright/test';
import { NATIVE_LIMITS, collectNativeCapture, emittedNativeChunks, nativeTarget, type NativeJourney, type NativeRow } from './support/portalPerformanceCausal';

test.setTimeout(180_000);
function emit(rows:NativeRow[]){for(const row of rows)console.log(JSON.stringify(row));}

async function dashboard(page:Page){await page.goto('/dashboard');await page.getByRole('heading',{name:'Dashboard',exact:true,level:1}).waitFor();}
async function nativeLink(page:Page,name:string){const link=page.getByRole('link',{name,exact:true}).first();await link.waitFor();await link.click();}

test('supplemental bounded native causal capture',async()=>{
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;let failed=false;let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const origin=nativeTarget(process.env),emitted=emittedNativeChunks(),deadline=Date.now()+NATIVE_LIMITS.batchMs;
    browser=await chromium.launch({headless:true});timer=setTimeout(()=>{void browser?.close().catch(()=>undefined);},NATIVE_LIMITS.batchMs);
    const context=await browser.newContext({baseURL:origin,storageState:process.env.PORTAL_STAFF_STORAGE_STATE?.trim()||'playwright/.auth/portal-staff.json',viewport:{width:1600,height:1000},serviceWorkers:'block',acceptDownloads:false});
    let gets=0;
    await context.route('**/*',async route=>{
      const request=route.request();let allowed=false;
      try {allowed=request.method()==='GET'&&new URL(request.url()).origin===origin&&++gets<=NATIVE_LIMITS.gets&&Date.now()<deadline;}catch{/* Invalid target is denied without logging. */}
      if(allowed)await route.continue();else await route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(15_000);page.setDefaultNavigationTimeout(20_000);
    const within=()=>{if(Date.now()>=deadline||gets>NATIVE_LIMITS.gets)throw 0;};
    const observe=async(journey:NativeJourney,action:()=>Promise<void>)=>{if(!await collectNativeCapture(page,journey,origin,emitted,action,emit))failed=true;within();};
    await observe('dashboard-cold',()=>dashboard(page));
    await observe('contacts-warm',async()=>{await nativeLink(page,'Contacts');await page.getByRole('heading',{name:'Contacts',exact:true,level:1}).waitFor();});
    await page.goto('/staff/projects');const open=page.getByRole('region',{name:'Projects list'}).locator('a[data-project-open]').first();await open.waitFor();
    const destination=new URL(String(await open.getAttribute('href')),origin);
    if(destination.origin!==origin||!/^\/staff\/projects\/(?:proj_)?[0-9a-f-]{36}$/i.test(destination.pathname))throw 0;
    await observe('detail-warm',async()=>{await open.click();await page.waitForURL(url=>url.pathname===destination.pathname);await page.locator('h1').first().waitFor();});
    await dashboard(page);const expand=page.getByRole('button',{name:'Expand Projects',exact:true}).first();if(await expand.count())await expand.click();
    await observe('running-warm',async()=>{await nativeLink(page,'Running Jobs');await page.getByRole('heading',{name:'Running Jobs',exact:true,level:1}).waitFor();});
    await page.goto('/staff/schedule');await page.locator('[data-board-lanes="true"][data-visible-crew-count]').waitFor();
    const toggle=page.getByRole('button',{name:/Collapse unscheduled panel|Expand unscheduled panel/});await toggle.waitFor();
    const before=await toggle.getAttribute('aria-expanded');
    if(before!=='true'&&before!=='false')throw 0;
    await observe('schedule-toggle',async()=>{await toggle.click();await page.waitForFunction(value=>{const button=document.querySelector('button[aria-label="Collapse unscheduled panel"],button[aria-label="Expand unscheduled panel"]');const current=button?.getAttribute('aria-expanded');return Boolean(button)&&(current==='true'||current==='false')&&current!==value;},before);});
    await context.close();
  } catch {failed=true;}
  finally {if(timer)clearTimeout(timer);await browser?.close().catch(()=>undefined);}
  if(failed)throw new Error('Supplemental native diagnostic incomplete.');
});
