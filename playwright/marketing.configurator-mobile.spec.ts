import { expect, test, type Page, type Locator } from '@playwright/test';
const next=async(page:Page,name:string)=>{if(name.startsWith('Edit ')&&!await page.getByRole('button',{name,exact:false}).isVisible())await page.getByText('Edit design',{exact:true}).click();await page.getByRole('button',{name,exact:true}).click();};
const toExtras=async(page:Page)=>{await next(page,'Set your size');await next(page,'Add sides & lighting');};
const toReview=async(page:Page)=>{await toExtras(page);await next(page,'Review your design');};
async function aboveFold(page:Page,locator:Locator){const b=await locator.boundingBox();const c=await page.locator('[data-journey-content]').boundingBox();expect(b).not.toBeNull();expect(b!.y).toBeGreaterThanOrEqual(c!.y-1);expect(b!.y+b!.height).toBeLessThanOrEqual(c!.y+c!.height+1);}
test.beforeEach(async({page,baseURL})=>{
 await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(baseURL!).origin?r.continue():r.abort());
 await page.route('**/api/enquiry',r=>r.abort());
 await page.addInitScript(()=>localStorage.setItem('sp_consent_v1',JSON.stringify({analytics:false,marketing:false,version:1,updatedAt:new Date().toISOString()})));
});
for(const width of [360,390,430])test(`four pages keep primary choices above fold at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===390?667:750});await page.goto('/configurator-preview?open=1');
 await page.getByRole('radio',{name:'Gable',exact:true}).check();
 await expect(page.getByText('Step 1 of 4',{exact:true})).toBeVisible();
 for(const name of ['Pitched','Gable','Box','Acrylic','Solid','Combination'])await aboveFold(page,page.getByRole('radio',{name,exact:true}));
 await aboveFold(page,page.locator('[data-roof-combination]'));
 await page.getByText('Roof & ceiling details',{exact:true}).click();await page.getByRole('radio',{name:'Extending',exact:true}).check();await expect(page.getByRole('radio',{name:'Extending',exact:true})).toBeChecked();await page.getByText('Roof & ceiling details',{exact:true}).click();
 await next(page,'Set your size');
 for(const name of ['Attached','Freestanding'])await aboveFold(page,page.getByRole('radio',{name,exact:true}));
 await next(page,'Add sides & lighting');
 await expect(page.getByText('Step 3 of 4',{exact:true})).toBeVisible();
 await aboveFold(page,page.getByRole('button',{name:'Lighting',exact:true}));
 for(const name of ['Previous side configuration','Next side configuration'])await aboveFold(page,page.getByRole('button',{name,exact:true}));
 await aboveFold(page,page.getByRole('heading',{name:'Open sides',exact:true}));
 await next(page,'Review your design');await expect(page.getByText('Step 4 of 4',{exact:true})).toBeVisible();
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

test('mobile freestanding selects ground and disables elevated until attached again',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');
 await next(page,'Set your size');
 await page.getByRole('radio',{name:'Elevated',exact:true}).check();
 await page.getByRole('radio',{name:'Freestanding',exact:true}).check();
 await expect(page.getByRole('radio',{name:'Ground',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'Elevated',exact:true})).toBeDisabled();
 await page.reload();
 await expect(page.getByRole('radio',{name:'Ground',exact:true})).toBeChecked();
 await expect(page.getByRole('radio',{name:'Elevated',exact:true})).toBeDisabled();
 await next(page,'Add sides & lighting');await next(page,'Review your design');
 await next(page,'Edit Size & structure');
 await expect(page.getByRole('radio',{name:'Elevated',exact:true})).toBeDisabled();
 await page.getByRole('radio',{name:'Attached',exact:true}).check();
 await expect(page.getByRole('radio',{name:'Elevated',exact:true})).toBeEnabled();
 await page.getByRole('radio',{name:'Elevated',exact:true}).check();
 await expect(page.getByRole('radio',{name:'Elevated',exact:true})).toBeChecked();
});
test('all nine combinations have matching decoded images and stable bounds',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');
 let bounds;const urls=new Set();
 for(const shape of ['Pitched','Gable','Box'])for(const material of ['Acrylic','Solid','Combination']){
  await page.getByRole('radio',{name:shape,exact:true}).check();await page.getByRole('radio',{name:material,exact:true}).check();
  const img=page.locator('[data-roof-combination] img');await expect(img).toHaveCount(1);await expect(img).toHaveAttribute('alt',new RegExp(`${shape} pergola with ${material.toLowerCase()}`));
  await img.evaluate((el:HTMLImageElement)=>el.decode());urls.add(await img.getAttribute('src'));
  const current=await page.locator('[data-roof-combination]').boundingBox();if(bounds)expect(current).toEqual(bounds);bounds=current;
 }
 expect(urls.size).toBe(9);
});
test('roof transitions retain the loaded image during a slow request and settle on the latest choice',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');
 const images=page.locator('[data-roof-combination] img');await images.evaluate((el:HTMLImageElement)=>el.decode());
 const original=await images.getAttribute('src');const bounds=await page.locator('[data-roof-combination]').boundingBox();
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/*roof-pitched-solid*',async route=>{await held;await route.continue();});
 await page.getByRole('radio',{name:'Solid',exact:true}).check();
 await expect(images).toHaveCount(2);
 await expect(images.first()).toHaveAttribute('src',original!);
 await expect(images.first()).toHaveCSS('opacity','1');
 await expect(images.last()).toHaveCSS('opacity','0');
 expect(await page.locator('[data-roof-combination]').boundingBox()).toEqual(bounds);
 release();await expect(images).toHaveCount(1);await expect(images).toHaveAttribute('alt',/solid roofing/);
 await page.getByRole('radio',{name:'Gable',exact:true}).check();
 await page.getByRole('radio',{name:'Combination',exact:true}).check();
 await page.getByRole('radio',{name:'Box',exact:true}).check();
 await expect(images).toHaveCount(1);await expect(images).toHaveAttribute('alt',/Box pergola with combination/);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('radio',{name:'Acrylic',exact:true}).check();
 await expect(images).toHaveCount(1);await expect(images).toHaveAttribute('alt',/Box pergola with acrylic/);
});
test('recommended sides browse the actual model without moving its camera and preserve custom edits',async({page})=>{
 await page.setViewportSize({width:390,height:667});await page.goto('/configurator-preview?open=1');await toExtras(page);
 const forward=page.getByRole('button',{name:'Next side configuration',exact:true});
 const back=page.getByRole('button',{name:'Previous side configuration',exact:true});
 const canvas=page.locator('canvas[data-camera]');await expect(canvas).toBeVisible();
 const camera=JSON.parse((await canvas.getAttribute('data-camera'))!);
 for(const [name,blinds,panels] of [['Front blinds',2,0],['Front & side blinds',4,0],['Front blinds + timber sides',2,2],['Timber sides · open front',0,2],['Open sides',0,0]] as const){
  await forward.click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.locator('[data-blind-count]')).toHaveAttribute('data-blind-count',String(blinds));
  await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count',String(panels));
  const current=JSON.parse((await canvas.getAttribute('data-camera'))!);
  for(let i=0;i<3;i++)expect(current.position[i]).toBeCloseTo(camera.position[i],3);
  await aboveFold(page,forward);await aboveFold(page,page.getByRole('heading',{name,exact:true}));
 }
 await back.focus();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('heading',{name:'Timber sides · open front',exact:true})).toBeVisible();
 const viewport=page.getByRole('region',{name:'Side configurations'}).locator('[class*="viewport"]').first();const b=(await viewport.boundingBox())!;
 await page.mouse.move(b.x+b.width*.7,b.y+b.height*.75);await page.mouse.down();await page.mouse.move(b.x+b.width*.3,b.y+b.height*.75,{steps:8});await page.mouse.up();
 await expect(page.getByRole('heading',{name:'Open sides',exact:true})).toBeVisible();
 await page.getByText('Customise sides',{exact:true}).click();await page.getByRole('checkbox',{name:/Front 1/}).check();await page.getByRole('radio',{name:'Timber',exact:true}).check();
 await expect(page.getByRole('heading',{name:'Your combination',exact:true})).toBeVisible();await page.reload();
 await expect(page.getByRole('heading',{name:'Your combination',exact:true})).toBeVisible();await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count','1');
 await page.getByRole('button',{name:'Lighting',exact:true}).click();await page.getByRole('button',{name:'Sides',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your combination',exact:true})).toBeVisible();await forward.click();
 await expect(page.getByRole('heading',{name:'Open sides',exact:true})).toBeVisible();await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count','0');
});

test('side groups apply immediately and retain same-kind customisation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/configurator-preview?open=1');await toExtras(page);
 await page.getByText('Customise sides',{exact:true}).click();await expect(page.getByRole('radio',{name:'Timber',exact:true})).toBeDisabled();
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
 await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count','3');
 await next(page,'Review your design');await page.reload();await expect(page.getByRole('region',{name:'Your pergola review'})).toBeVisible();
 await next(page,'Edit Sides & privacy');await page.getByText('Customise sides',{exact:true}).click();await expect(page.getByRole('checkbox',{name:/Front 1 Timber/})).toBeVisible();
});
test('lighting is one page, stable camera, and night is confined to the lighting tab',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');await toExtras(page);await next(page,'Lighting');
 await expect(page.locator('canvas')).toHaveAttribute('data-camera',/perspective/);
 const camera=()=>page.locator('canvas').evaluate(el=>{const c=JSON.parse(el.getAttribute('data-camera')!);return [...c.position,...c.target,c.distance].map((n:number)=>Math.round(n*1000)/1000);});
 const initial=await camera();
 expect(JSON.parse((await page.locator('canvas').getAttribute('data-camera'))!).fov).toBe(75);
 for(const name of ['Gentle','Brighter','No lights']){const choice=page.getByRole('button',{name:new RegExp(`^${name}`)});await choice.click();await expect(choice).toHaveAttribute('aria-pressed','true');await expect(choice).toHaveAccessibleName(new RegExp(`^${name}`));await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','true');expect(await camera()).toEqual(initial);await aboveFold(page,choice);}
 await next(page,'Sides');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','false');await next(page,'Review your design');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','false');
 await expect(page.getByRole('group',{name:'Choose view'})).toHaveCount(0);await expect(page.getByRole('group',{name:'Time of day'})).toHaveCount(0);
});

test('lighting uses an interior view after side refinement and settles without changing screens',async({page})=>{
 await page.setViewportSize({width:390,height:667});await page.goto('/configurator-preview?open=1');
 await page.getByRole('radio',{name:'Solid',exact:true}).check();await toExtras(page);
 for(let i=0;i<3;i++)await next(page,'Next side configuration');
 await page.getByText('Customise sides',{exact:true}).click();
 await page.getByText('Locate & refine sides',{exact:true}).click();
 await page.getByRole('combobox',{name:'Opening to refine'}).selectOption({label:'Front 1'});
 await next(page,'Lighting');await page.getByRole('button',{name:/^Brighter/}).click();
 await expect(page.locator('canvas[data-camera]')).toHaveAttribute('data-camera',/"fov":75/);
 await expect(page.getByText('Editing Front 1',{exact:true})).toHaveCount(0);
 await expect(page.locator('[data-blind-count]')).toHaveAttribute('data-blind-count','2');
 await expect(page.locator('[data-side-panel-count]')).toHaveAttribute('data-side-panel-count','2');
 const camera=JSON.parse((await page.locator('canvas').getAttribute('data-camera'))!);
 expect(camera.position[0]).toBeGreaterThan(0);expect(camera.position[0]).toBeLessThan(6000);
 expect(camera.position[1]).toBeGreaterThan(0);expect(camera.position[1]).toBeLessThan(3000);
 expect(camera.position[2]).toBeGreaterThan(1000);expect(camera.position[2]).toBeLessThan(1700);
 const canvas=page.locator('canvas'),box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5,{steps:8});await page.mouse.up();
 const orbited=JSON.parse((await canvas.getAttribute('data-camera'))!);expect(orbited.position).not.toEqual(camera.position);
 await page.getByRole('button',{name:/^Gentle/}).click();
 const retained=JSON.parse((await canvas.getAttribute('data-camera'))!);
 for(let i=0;i<3;i++){expect(retained.position[i]).toBeCloseTo(orbited.position[i],3);expect(retained.target[i]).toBeCloseTo(orbited.target[i],3);}
 await expect(canvas).toHaveAttribute('data-studio-state','settled');
 // Allow the final DPR/shadow invalidation, then require a full idle window.
 await expect.poll(async()=>{const frames=await canvas.getAttribute('data-studio-frames');await page.waitForTimeout(1000);return await canvas.getAttribute('data-studio-frames')===frames;},{timeout:10000}).toBe(true);
 await next(page,'Sides');await expect(page.getByRole('heading',{name:'Front blinds + timber sides',exact:true})).toBeVisible();
 await next(page,'Review your design');await page.locator('[data-design-portrait="captured"]').waitFor();
 await page.getByRole('region',{name:'Your pergola review'}).getByRole('button',{name:'Explore your design',exact:true}).click();await expect(page.locator('canvas[data-camera]')).toHaveAttribute('data-camera',/"fov":24/);
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
 await next(page,'Add sides & lighting');await next(page,'Review your design');await page.getByRole('region',{name:'Your pergola review'}).getByRole('button',{name:'Explore your design'}).click();await expect(page.locator('canvas')).toBeVisible();await next(page,'Return to review');
});
for(const [oldStep,newStep] of [['shape','roof'],['explore','extras'],['review','review'],['finished','review']])test(`saved ${oldStep} progress migrates to ${newStep}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.addInitScript(step=>localStorage.setItem('sanctuary.mobile-journey.v1',step),oldStep);await page.goto('/configurator-preview?open=1');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step',newStep);
});
test('starting a new design clears the previous side targets and lighting tab',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/configurator-preview?open=1');await toExtras(page);await page.getByText('Customise sides',{exact:true}).click();
 await page.getByRole('checkbox',{name:/Front 1/}).check();await page.getByRole('radio',{name:'Timber',exact:true}).check();
 await page.getByRole('button',{name:'Lighting',exact:true}).click();await next(page,'Review your design');
 await next(page,'Start a new design');await next(page,'Start new design');await toExtras(page);
 await expect(page.getByRole('button',{name:'Sides',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByText('Customise sides',{exact:true}).click();
 for(const checkbox of await page.getByRole('checkbox').all())await expect(checkbox).not.toBeChecked();
 await expect(page.getByRole('radio',{name:'Timber',exact:true})).toBeDisabled();
 await expect(page.getByText('Choose one or more sides above.',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Choose your sides',exact:true}).getByRole('alert')).toHaveCount(0);
});

test('normal entry, reset confirmation and increased text remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('radio',{name:/Design your pergola/}).click();await expect(page.getByRole('heading',{name:'Find your roof.'})).toBeFocused();
 await toReview(page);await next(page,'Start a new design');await expect(page.getByText('Replace this design and start again?',{exact:true})).toBeVisible();await next(page,'Keep this design');await next(page,'Start a new design');await next(page,'Start new design');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-mobile-step','roof');
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
  await page.goto('/configurator-preview?open=1'); await toReview(page);
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

test('review editing has a clear section chooser and direct return without losing enquiry details',async({page})=>{
 await page.setViewportSize({width:390,height:667});await page.goto('/configurator-preview?open=1');await toReview(page);
 await aboveFold(page,page.getByRole('button',{name:'Edit design',exact:true}));
 await next(page,'Enquire');await page.getByLabel('Name',{exact:true}).fill('Local review tester');
 await next(page,'Edit design');await expect(page.getByRole('heading',{name:'Edit your design.'})).toBeFocused();
 for(const name of ['Edit Roof & ceiling','Edit Size & structure','Edit Sides & privacy','Edit Lighting'])await aboveFold(page,page.getByRole('button',{name,exact:true}));
 await next(page,'Edit Roof & ceiling');await page.getByRole('radio',{name:'Gable',exact:true}).check();await next(page,'All sections');
 await expect(page.getByRole('button',{name:'Edit Roof & ceiling'})).toContainText('Gable');
 await next(page,'Edit Size & structure');await page.getByRole('radio',{name:'Freestanding',exact:true}).check();await next(page,'All sections');
 await expect(page.getByRole('button',{name:'Edit Size & structure'})).toContainText('Freestanding');
 await next(page,'Edit Sides & privacy');await next(page,'Next side configuration');await next(page,'All sections');
 await next(page,'Edit Lighting');await expect(page.locator('[data-mobile-step]')).toHaveAttribute('data-night','true');await next(page,'Return to review');
 await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Local review tester');
 await page.getByRole('region',{name:'Your pergola review',exact:true}).getByRole('button',{name:'Explore your design',exact:true}).click();await next(page,'Return to review');
 await next(page,'Edit design');await next(page,'Connection & design options');await next(page,'All sections');await next(page,'Return to review');
 await expect(page.getByRole('button',{name:'Enquire',exact:true})).toBeVisible();
});

test('mobile size drag stays local until release and preserves the final size through review',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/configurator-preview?open=1');
 await next(page,'Set your size');
 const range=page.getByRole('slider',{name:'Width',exact:true});
 const draft=page.locator('[data-mobile-size-draft]');
 const committed=await draft.getAttribute('data-committed-width');
 const box=(await range.boundingBox())!;
 await page.mouse.move(box.x+box.width*.4,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.8,box.y+box.height/2,{steps:20});
 const live=await range.inputValue();expect(live).not.toBe(committed);
 await expect(draft).toHaveAttribute('data-committed-width',committed!);
 await expect(page.locator('[data-mobile-footprint]')).toHaveAttribute('aria-label',new RegExp(`width ${(Number(live)/1000).toFixed(1)} m`));
 await page.mouse.up();await expect(draft).toHaveAttribute('data-committed-width',live);
 await range.focus();await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowLeft');
 const keyboardValue=await range.inputValue();await expect(draft).toHaveAttribute('data-committed-width',live);
 await page.keyboard.up('ArrowLeft');await expect(draft).toHaveAttribute('data-committed-width',keyboardValue);
 await next(page,'Add sides & lighting');await next(page,'Review your design');
 await expect(page.getByRole('region',{name:'Your pergola review'})).toContainText(`${(Number(keyboardValue)/1000).toFixed(1)} ×`);
 await next(page,'Edit design');await next(page,'Edit Size & structure');
 await expect(page.getByRole('slider',{name:'Width',exact:true})).toHaveValue(keyboardValue);
});

test('extras explain selected faces and lighting, and never show an old price after a change',async({page})=>{
 await page.setViewportSize({width:390,height:667});
 let delay=false,unavailable=false;
 await page.route('**/api/configurator-price',async route=>{
  if(delay)await new Promise(resolve=>setTimeout(resolve,1200));
  await route.fulfill({json:unavailable?{status:'unavailable'}:{status:'priced',amountIncGst:delay?24000:20000,currency:'NZD',includesGst:true,breakdown:[],versionNumber:1,calculationRef:'synthetic-preview'}});
 });
 await page.goto('/configurator-preview?open=1');await toExtras(page);
 const sides=page.getByRole('region',{name:'Side configurations'});
 const faces=page.locator('dl[aria-label="Selected side treatments"]');
 await expect(faces.locator('dd')).toHaveText(['Open','Open','Open']);
 await expect(sides.locator('[class*=estimate][role=status]')).toContainText('$20,000');
 delay=true;
 await next(page,'Next side configuration');
 await expect(faces.locator('dd')).toHaveText(['Open','Blinds','Open']);
 await expect(sides.locator('[class*=estimate][role=status]')).toHaveText('Updating estimate…');
 await expect(sides).not.toContainText('$20,000');
 await expect(sides.locator('[class*=estimate][role=status]')).toContainText('$24,000');
 await next(page,'Next side configuration');await next(page,'Next side configuration');
 await expect(faces.locator('dd')).toHaveText(['Timber','Blinds','Timber']);
 await aboveFold(page,faces);
 unavailable=true;
 await next(page,'Lighting');await page.getByRole('button',{name:/^Gentle/}).click();
 const lighting=page.getByRole('region',{name:'Choose lighting'});
 await expect(lighting).toContainText('Estimate unavailable · continue to review');
 await expect(lighting).not.toContainText('$24,000');
 const viewport=page.locator('[data-light-rafter-count]');
 const count=Number(await viewport.getAttribute('data-light-rafter-count'))+Number(await viewport.getAttribute('data-light-cedar-count'));
 await expect(page.getByRole('button',{name:/^Gentle/})).toContainText(`${count} lights`);
 await aboveFold(page,page.getByRole('button',{name:/^Brighter/}));
 await next(page,'Review your design');await page.locator('[data-design-portrait="captured"]').waitFor();
 expect((await page.locator('[data-design-portrait]').boundingBox())!.height).toBeGreaterThanOrEqual(185);
 await aboveFold(page,page.getByRole('button',{name:'Enquire',exact:true}));
 await aboveFold(page,page.getByRole('button',{name:'Share design',exact:true}));
});
