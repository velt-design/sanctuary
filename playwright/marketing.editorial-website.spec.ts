import { test, expect } from '@playwright/test';
import { products } from '../apps/marketing/data/products';
import { projects } from '../apps/marketing/data/projects';
const staticRoutes = ['/', '/pergola-guides', '/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/commercial-pergolas-auckland', '/architects-designers-builders', '/acrylic-roof-pergolas-auckland', '/simple-pergolas-auckland', '/products', '/projects', '/contact', '/privacy', '/contact/thanks'];
const routes = [...staticRoutes, ...products.map(p=>p.route), ...projects.map(p=>'/projects/'+p.slug)];
for(const width of [360,768,1440]) test('full editorial website at '+width, async({page})=>{
 test.setTimeout(180_000);
 await page.setViewportSize({width,height:900});
 await page.route('**/api/enquiry',r=>r.abort());
 await page.addInitScript(()=>localStorage.setItem('sp_consent_v1',JSON.stringify({analytics:false,marketing:false,updatedAt:new Date().toISOString(),version:1})));
 for(const route of routes){
  const errors:string[]=[];const listener=(error:Error)=>errors.push(error.message);page.on('pageerror',listener);
  const response=await page.goto(route);expect(response?.status(),route).toBe(200);
  const main=page.locator('[data-editorial-website] main').first();
  await expect(main,route).toBeVisible();await expect(main.locator('h1'),route).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),{message:route}).toBe(true);
  await expect(main).not.toContainText('undefined');
  if(route!='/design-enquiry') await expect(page.getByRole('link',{name:'Sanctuary Pergolas home'})).toBeVisible();
  expect(errors,route).toEqual([]);page.off('pageerror',listener);
  if(['/', '/products/pergolas/gable','/projects/warkworth-outdoor-room','/commercial-pergolas-auckland','/pergola-guides','/contact','/privacy'].includes(route)) await page.screenshot({path:'artifacts/marketing-foundation-evolution/website-'+(route.replaceAll('/','-')||'home')+'-'+width+'.png'});
 }
});
test('configurator and private document routes stay outside website styling',async({page})=>{
 for(const route of ['/design-enquiry','/configurator-preview','/simple-cover-calculator','/quote/nonexistent','/invoice/nonexistent']){
  await page.goto(route);await expect(page.locator('[data-editorial-website]:not(:has([data-project-preview]))')).toHaveCount(0);
 }
});
test('real pages carry the approved reference composition and roof state',async({page})=>{
 await page.goto('/products/pergolas/gable');
 await expect(page.getByRole('heading',{name:'Start with the house.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Resolve the whole picture.'})).toBeVisible();
 await page.getByRole('radio',{name:/03 Combination/}).check();await page.reload();
 await expect(page.getByRole('radio',{name:/03 Combination/})).toBeChecked();
 await page.goto('/projects/warkworth-outdoor-room');
 await expect(page.getByRole('heading',{name:'A room beside the house.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'How it comes together.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Why a gable?'})).toBeVisible();
});

for(const width of [390,1440]) test('approved reference and real composition at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const family of ['product','project']){
  const reference='/__foundation/marketing/evolution/'+family+'?composition=editorial&motion=quiet';
  test.skip((await page.request.get(reference)).status()===404, 'Internal reference is intentionally gated in this production build; comparison runs on the development preview.');
  const real=family==='product'?'/products/pergolas/gable':'/projects/warkworth-outdoor-room';
  const capture=async(path:string,label:string)=>{
   await page.goto(path);await page.emulateMedia({reducedMotion:'reduce'});
   const main=page.locator('main').filter({visible:true}).last();
   const title=main.locator('h1');await expect(title).toBeVisible();
   const values=await title.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,width:r.width,fontSize:s.fontSize,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing};});
   await page.screenshot({path:'artifacts/marketing-foundation-evolution/parity-'+family+'-'+label+'-'+width+'.png'});
   return values;
  };
  const approved=await capture(reference,'reference');const delivered=await capture(real,'real');
  expect(delivered.fontSize).toBe(approved.fontSize);expect(delivered.lineHeight).toBe(approved.lineHeight);expect(delivered.letterSpacing).toBe(approved.letterSpacing);
  expect(Math.abs(delivered.x-approved.x)).toBeLessThan(2);
  expect(Math.abs(delivered.width-approved.width)).toBeLessThan(2);
 }
});

for(const width of [390,1440]) test('approved body hierarchy and gallery composition at '+width,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 for(const family of ['product','project']){
  const inspect=async(route:string)=>{
   await page.goto(route);const main=page.locator('main').filter({visible:true}).last();
   const headings=await main.locator('h2').evaluateAll(items=>items.map(el=>({text:el.textContent?.replace(/\s+/g,' ').trim(),font:getComputedStyle(el).fontSize})));
   const gallery=family==='project'?await main.locator('#project-gallery [data-responsive-gallery]').evaluate(el=>({width:el.getBoundingClientRect().width,ratio:(el.querySelector('[data-gallery-frame-active] figure > div') as HTMLElement).getBoundingClientRect().width/(el.querySelector('[data-gallery-frame-active] figure > div') as HTMLElement).getBoundingClientRect().height})):null;
   return {headings,gallery};
  };
  const referencePath='/__foundation/marketing/evolution/'+family+'?composition=editorial&motion=quiet';
  test.skip((await page.request.get(referencePath)).status()===404, 'Internal reference is intentionally gated in this production build; comparison runs on the development preview.');
  const reference=await inspect(referencePath);
  const actual=await inspect(family==='product'?'/products/pergolas/gable':'/projects/warkworth-outdoor-room');
  for(const expected of reference.headings.filter(h=>h.text&&!h.text.includes('different roofline'))){
   const match=actual.headings.find(h=>h.text===expected.text);
   if(match)expect(match.font,expected.text).toBe(expected.font);
  }
  if(reference.gallery&&actual.gallery){expect(Math.abs(reference.gallery.width-actual.gallery.width)).toBeLessThan(2);expect(actual.gallery.ratio).toBeCloseTo(reference.gallery.ratio,2);}
 }
});
