import { expect, test, type Page, type Locator } from '@playwright/test';
const next=async(page:Page,name:string)=>{if(name.startsWith('Edit ')&&!await page.getByRole('button',{name,exact:false}).isVisible())await page.getByText('Edit design',{exact:true}).click();await page.getByRole('button',{name,exact:true}).click();};
const toExtras=async(page:Page)=>{await next(page,'Set your size');await next(page,'Add sides & lighting');};
const toModel=async(page:Page)=>{await toExtras(page);await next(page,'See your pergola');};
async function aboveFold(page:Page,locator:Locator){const b=await locator.boundingBox();const c=await page.locator('[data-journey-content]').boundingBox();expect(b).not.toBeNull();expect(b!.y).toBeGreaterThanOrEqual(c!.y-1);expect(b!.y+b!.height).toBeLessThanOrEqual(c!.y+c!.height+1);}
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(baseURL!).origin?r.continue():r.abort());
 await page.route('**/api/enquiry',r=>r.abort());
 await page.addInitScript(()=>localStorage.setItem('sp_consent_v1',JSON.stringify({analytics:false,marketing:false,version:1,updatedAt:new Date().toISOString()})));
});
for(const width of [360,390,430])test(`five pages keep primary choices above fold at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?667:750});await page.goto('/configurator-preview?open=1');
 await page.getByRole('radio',{name:'Gable',exact:true}).check();
 await expect(page.getByText('Step 1 of 5',{exact:true})).toBeVisible();
 for(const name of ['Pitched','Gable','Box','Acrylic','Solid','Combination'])await aboveFold(page,page.getByRole('radio',{name,exact:true}));
 await aboveFold(page,page.locator('[data-roof-combination]'));
 await page.getByText('Roof & ceiling details',{exact:true}).click();await page.getByRole('radio',{name:'Extending',exact:true}).check();await expect(page.getByRole('radio',{name:'Extending',exact:true})).toBeChecked();await page.getByText('Roof & ceiling details',{exact:true}).click();
 await next(page,'Set your size');
 for(const name of ['Attached','Freestanding'])await aboveFold(page,page.getByRole('radio',{name,exact:true}));
 await next(page,'Add sides & lighting');
 await expect(page.getByText('Step 3 of 5',{exact:true})).toBeVisible();
 await aboveFold(page,page.getByRole('button',{name:'Lighting',exact:true}));
 for(const name of ['Open','Timber','Aluminium','Blind','Acrylic'])await aboveFold(page,page.getByRole('radio',{name,exact:true}));
 await next(page,'See your pergola');await expect(page.getByText('Step 4 of 5',{exact:true})).toBeVisible();await expect(page.locator('canvas')).toBeVisible();
 await next(page,'Review your design');await expect(page.getByText('Step 5 of 5',{exact:true})).toBeVisible();
 await aboveFold(page,page.getByRole('button',{name:'Enquire',exact:true}));await aboveFold(page,page.getByRole('button',{name:'Share design',exact:true}));
});
test('short-screen size keeps the complete attachment choice visible with roof limit notes',async({page})=>{
 await page.setViewportSize({width:390,height:667});await page.goto('/configurator-preview?open=1');
 for(const shape of ['Pitched','Gable','Box'])for(const material of ['Acrylic','Solid','Combination']){
  await page.getByRole('radio',{name:shape,exact:true}).check();await page.getByRole('radio',{name:material,exact:true}).check();
  await next(page,'Set your size');
  for(const name of ['Attached','Freestanding'])await aboveFold(page,page.getByRole('radio',{name,exact:true}).locator('..'));
  await next(page,'Back');
 }
});

test('all nine combinations have matching decoded images and stable bounds',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');
 let bounds;const urls=new Set();
 for(const shape of ['Pitched','Gable','Box'])for(const material of ['Acrylic','Solid','Combination']){
  await page.getByRole('radio',{name:shape,exact:true}).check();await page.getByRole('radio',{name:material,exact:true}).check();
  const img=page.locator('[data-roof-combination] img');await expect(img).toHaveAttribute('alt',new RegExp(`${shape} pergola with ${material.toLowerCase()}`));
  await img.evaluate((el:HTMLImageElement)=>el.decode());urls.add(await img.getAttribute('src'));
  const current=await page.locator('[data-roof-combination]').boundingBox();if(bounds)expect(current).toEqual(bounds);bounds=current;
 }
 expect(urls.size).toBe(9);
});
test('side groups apply immediately and retain same-kind customisation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/configurator-preview?open=1');await toExtras(page);
 await expect(page.getByRole('radio',{name:'Timber',exact:true})).toBeDisabled();
 for(const name of ['Front 1','Front 2'])await page.getByRole('checkbox',{name:new RegExp(name)}).check();
 await page.getByRole('radio',{name:'Timber',exact:true}).check();
 for(const name of ['Front 1','Front 2'])await expect(page.getByRole('checkbox',{name:new RegExp(`${name} Timber`)})).toBeChecked();
 await page.getByText('Locate & refine sides',{exact:true}).click();
 await page.getByRole('combobox',{name:'Opening to refine'}).selectOption({label:'Front 1'});
 await page.getByText('Refine your screen finish',{exact:true}).click();
 await page.getByRole('radio',{name:'Horizontal',exact:true}).check();
 await page.getByText('Locate & refine sides',{exact:true}).click();
 await page.getByRole('checkbox',{name:/Front 2/}).uncheck();await page.getByRole('checkbox',{name:/Left 1/}).check();
 await expect(page.getByText('Mixed treatments. Choose one for these sides.',{exact:true})).toBeVisible();
 await page.getByRole('radio',{name:'Timber',exact:true}).check();
 await page.getByText('Locate & refine sides',{exact:true}).click();
 await expect(page.getByRole('radio',{name:'Horizontal',exact:true})).toBeChecked();
 await next(page,'See your pergola');await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count','3');
 await next(page,'Review your design');await page.reload();await expect(page.getByRole('region',{name:'Your pergola review'})).toBeVisible();
 await next(page,'Edit Sides & privacy');await expect(page.getByRole('checkbox',{name:/Front 1 Timber/})).toBeVisible();
});
test('lighting is one page, stable camera, and night is confined to the lighting tab',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');await toExtras(page);await next(page,'Lighting');
 await expect(page.locator('canvas')).toHaveAttribute('data-camera',/perspective/);
 const camera=()=>page.locator('canvas').evaluate(el=>{const c=JSON.parse(el.getAttribute('data-camera')!);return [...c.position,...c.target,c.distance].map((n:number)=>Math.round(n*1000)/1000);});
 const initial=await camera();
 for(const name of ['A gentle glow','More light','No lighting']){await next(page,name);await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','true');expect(await camera()).toEqual(initial);await aboveFold(page,page.getByRole('button',{name,exact:true}));}
 await next(page,'Sides');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','false');await next(page,'See your pergola');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','false');
 await expect(page.getByRole('group',{name:'Choose view'})).toHaveCount(0);await expect(page.getByRole('group',{name:'Time of day'})).toHaveCount(0);
});
for(const [width,projection] of [[6,3],[1.5,6],[10,1.5]])test(`size plan, slider and attachment remain usable for ${width}x${projection}`,async({page})=>{
 await page.setViewportSize({width:360,height:750});await page.goto('/configurator-preview?open=1');await next(page,'Set your size');
 const plan=page.locator('[data-mobile-footprint]');const original=await plan.boundingBox();
 for(const [name,value] of [['Width',width],['Projection',projection]] as const){const field=page.getByRole('textbox',{name:`${name} in metres`});await field.fill(String(value));await field.press('Enter');}
 await expect(plan).toHaveAttribute('aria-label',new RegExp(`width ${width.toFixed(1)} m, projection ${projection.toFixed(1)} m`));expect((await plan.boundingBox())!.height).toBe(original!.height);
 expect(await plan.evaluate(svg=>{const b=svg.getBoundingClientRect();return [...svg.querySelectorAll('text')].every(t=>{const r=t.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom;});})).toBe(true);
 await page.getByRole('radio',{name:'Freestanding',exact:true}).check();await expect(plan.locator('[data-house-edge]')).toHaveCount(0);
 await page.getByRole('radio',{name:'Attached',exact:true}).check();await expect(plan.locator('[data-house-edge]')).toHaveCount(1);
 const slider=page.getByRole('slider',{name:'Projection',exact:true});await expect(slider).toHaveCSS('opacity','0');await slider.focus();await slider.press('ArrowLeft');
 await next(page,'Add sides & lighting');await next(page,'See your pergola');await expect(page.locator('canvas')).toBeVisible();
});
for(const [oldStep,newStep] of [['shape','roof'],['explore','extras'],['review','review']])test(`saved ${oldStep} progress migrates to ${newStep}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(step=>localStorage.setItem('sanctuary.mobile-journey.v1',step),oldStep);await page.goto('/configurator-preview?open=1');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step',newStep);
});
test('starting a new design clears the previous side targets and lighting tab',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');await toExtras(page);
 await page.getByRole('checkbox',{name:/Front 1/}).check();await page.getByRole('radio',{name:'Timber',exact:true}).check();
 await page.getByRole('button',{name:'Lighting',exact:true}).click();await next(page,'See your pergola');await next(page,'Review your design');
 await next(page,'Start a new design');await next(page,'Start new design');await toExtras(page);
 await expect(page.getByRole('button',{name:'Sides',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const checkbox of await page.getByRole('checkbox').all())await expect(checkbox).not.toBeChecked();
 await expect(page.getByRole('radio',{name:'Timber',exact:true})).toBeDisabled();
 await expect(page.getByText('Choose one or more sides above.',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Choose your sides',exact:true}).getByRole('alert')).toHaveCount(0);
});

test('normal entry, reset confirmation and increased text remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('radio',{name:/Design your pergola/}).click();await expect(page.getByRole('heading',{name:'Find your roof.'})).toBeFocused();
 await toModel(page);await next(page,'Review your design');await next(page,'Start a new design');await expect(page.getByText('Replace this design and start again?',{exact:true})).toBeVisible();await next(page,'Keep this design');await next(page,'Start a new design');await next(page,'Start new design');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step','roof');
 await page.addStyleTag({content:'[data-mobile-step] {font-size:24px} [data-mobile-step] label,[data-mobile-step] button,[data-mobile-step] p {font-size:20px!important}'});await next(page,'Set your size');await page.getByRole('radio',{name:'Elevated',exact:true}).check();await next(page,'Add sides & lighting');
});
test('mobile finish shares a snapshot and sends inline with validation and retry', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Isolated transport: no customer enquiry leaves the browser. HTTP preview lacks randomUUID.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: () => '00000000-0000-4000-8000-000000000001', configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (url: string) => { sessionStorage.setItem('test-share-link', url); } }, configurable: true });
  });
  const submissions: { customerDesign: { input: { widthMm: number } }; submissionId: string }[] = [];
  await page.route('**/api/enquiry', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ status: submissions.length === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(submissions.length === 1 ? { ok: false, error: 'Test service unavailable' } : { ok: true }) });
  });
  await page.goto('/configurator-preview?open=1'); await toModel(page);
  await next(page, 'Review your design');
  await page.getByRole('button', { name: 'Share design', exact: true }).click();
  const link = await page.evaluate(() => sessionStorage.getItem('test-share-link'));
  expect(link).toContain('#design=');
  await page.getByRole('button', { name: 'Enquire', exact: true }).click();
  await next(page, 'Enquire about this design');
  await expect(page.locator('#contact-name')).toHaveAttribute('aria-invalid', 'true');
  expect(submissions).toHaveLength(0);
  await page.locator('#contact-name').fill('Test Customer');
  await page.locator('#contact-suburb').fill('Test suburb');
  await page.locator('#contact-email').fill('test@example.com');
  await next(page, 'Edit Size & structure');
  const width = page.getByRole('textbox', { name: 'Width in metres', exact: true });
  await width.fill('5.2'); await width.press('Enter'); await next(page, 'Return to review');
  await expect(page.locator('#contact-name')).toHaveValue('Test Customer');
  await next(page, 'Enquire about this design');
  await expect(page.getByText('Test service unavailable', { exact: true })).toBeVisible();
  await next(page, 'Enquire about this design');
  await expect(page.getByRole('heading', { name: 'Design saved. Enquiry sent.' })).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1].customerDesign.input.widthMm).toBe(5200);
  expect(submissions[1].submissionId).toBe(submissions[0].submissionId);
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 390, height: 844 });
  await reopened.goto(link!);
  await expect(reopened.getByRole('region', { name: 'Your pergola review' })).toContainText('6.0 × 3.0');
  await reopened.close();
  await next(page, 'Edit Size & structure');
  await width.fill('5.4'); await width.press('Enter'); await next(page, 'Return to review');
  await expect(page.getByRole('heading', { name: 'Design saved. Enquiry sent.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enquire about this design' })).toBeVisible();
});
