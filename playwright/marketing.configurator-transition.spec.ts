import { test, expect, type Page } from '@playwright/test';

const evidence = process.env.DAY_NIGHT_EVIDENCE_DIR || 'test-results/day-night';
async function openDesign(page: Page, width: number, solid: boolean) {
  await page.setViewportSize({width,height:900});
  await page.goto('/configurator-preview?open=1');
  const consent=page.getByRole('button',{name:'Essential only',exact:true});
  if(await consent.isVisible())await consent.click();
  await page.getByRole('radio',{name:'Gable',exact:true}).check();
  for(const name of ['Width in metres','Projection in metres']) {
    await page.getByRole('textbox',{name}).fill('4.0');
    await page.getByRole('textbox',{name}).press('Tab');
  }
  await page.getByRole('radio',{name:'Freestanding',exact:true}).check();
  if(solid){
    await page.getByRole('button',{name:/^Personalise(?: your pergola)? →$/}).click();
    await page.getByRole('button',{name:/^Roof & ceiling/}).click();
    await page.getByRole('radio',{name:/^Solid \+ timber ceiling/}).check();
    await page.getByRole('radio',{name:'Tray',exact:true}).check();
    await page.getByRole('radio',{name:'500 mm',exact:true}).check();
    await page.getByRole('radio',{name:'ThermoPine',exact:true}).check();
    await page.getByRole('button',{name:'← Back to Personalise',exact:true}).click();
    await page.getByRole('button',{name:/^Lighting /}).click();
    await page.getByRole('button',{name:/^Ceiling downlights/}).click();
    await page.getByRole('button',{name:/^4 lights/}).click();
  }
  if(width<720)await page.getByRole('button',{name:'Expand view',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera',/perspective/);
  await expect.poll(()=>amount(page)).toBe(0);
  await page.waitForTimeout(1200); // allow initial camera layout and optional price request to settle
}
const amount=(page:Page)=>page.locator('[data-view]').evaluate(el=>Number((el as HTMLElement).style.getPropertyValue('--night-amount')));
const mood=(page:Page,name:string)=>page.getByRole('group',{name:'Time of day'}).getByRole('button',{name,exact:true});

for(const width of [1440,390])for(const solid of [false,true])test(`smooth day/night ${width} ${solid?'lit solid':'unlit acrylic'}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await openDesign(page,width,solid);
  const shellColors=()=>page.locator('[data-night]').evaluate(el=>[el, ...el.querySelectorAll('aside,p')].map(node=>{const s=getComputedStyle(node);return [s.backgroundColor,s.color];}));
  const palette=await shellColors();
  const camera=await page.locator('canvas').getAttribute('data-camera');
  const draft=await page.evaluate(()=>JSON.stringify(localStorage));
  const state=await page.locator('[data-view]').evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])));
  const priceRequests:string[]=[];page.on('request',request=>{if(/\/api\/.*price/.test(request.url()))priceRequests.push(request.postData()||'');});
  await page.screenshot({path:`${evidence}/${width}-${solid}-day.png`});
  // Sample actual rendered-frame progress. Each frame shares its amount with the backdrop and lights.
  const samples=page.evaluate(()=>new Promise<number[]>(resolve=>{
    const values:number[]=[];const start=performance.now();
    function frame(){values.push(Number((document.querySelector('[data-view]') as HTMLElement).style.getPropertyValue('--night-amount')));if(performance.now()-start<1500)requestAnimationFrame(frame);else resolve(values);}
    requestAnimationFrame(frame);
  }));
  await mood(page,'Night').click();
  await expect.poll(()=>amount(page),{intervals:[30]}).toBeGreaterThan(.15);
  await page.screenshot({path:`${evidence}/${width}-${solid}-mid.png`});
  await expect.poll(()=>amount(page)).toBe(1);
  const values=await samples;
  expect(await shellColors()).toEqual(palette);
  expect(values.filter(v=>v>0&&v<1).length).toBeGreaterThan(5);
  expect(values.every((v,i)=>i===0||v>=values[i-1])).toBe(true);
  await page.screenshot({path:`${evidence}/${width}-${solid}-night.png`});
  expect(await page.locator('canvas').getAttribute('data-camera')).toBe(camera);
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(draft);
  expect(await page.locator('[data-view]').evaluate(el=>Object.fromEntries([...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])))).toEqual(state);
  expect(priceRequests).toEqual([]);
  await mood(page,'Day').click();
  // Reverse inside the sampled frame, avoiding automation round-trip timing races.
  const before=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{
    const start=performance.now();
    function frame(){
      const value=Number((document.querySelector('[data-view]') as HTMLElement).style.getPropertyValue('--night-amount'));
      if(value>0&&value<.9){
        const button=[...document.querySelectorAll('[aria-label="Time of day"] button')].find(el=>el.textContent==='Night') as HTMLButtonElement;
        button.click();resolve(value);
      }else if(performance.now()-start>2000)reject(new Error('No intermediate rendered frame before reversal'));
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  await expect.poll(()=>amount(page)).toBe(1);
  expect(before).toBeGreaterThan(0);
  await mood(page,'Day').click();await expect.poll(()=>amount(page)).toBe(0);
  expect(await page.locator('canvas').getAttribute('data-camera')).toBe(camera);
  expect(errors).toEqual([]);
  await test.info().attach('render-frame-progress',{body:JSON.stringify(values),contentType:'application/json'});
});

test('reduced motion switches immediately and responds to live preference changes',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openDesign(page,1440,true);
 await mood(page,'Night').click();await expect.poll(()=>amount(page),{intervals:[20],timeout:500}).toBe(1);
 await page.emulateMedia({reducedMotion:'no-preference'});await mood(page,'Day').click();
 const intermediate=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{
   const start=performance.now();
   function frame(){const value=Number((document.querySelector('[data-view]') as HTMLElement).style.getPropertyValue('--night-amount'));if(value>0&&value<1)resolve(value);else if(performance.now()-start>2000)reject(new Error('No animated frame after disabling reduced motion'));else requestAnimationFrame(frame);}
   requestAnimationFrame(frame);
 }));
 expect(intermediate).toBeGreaterThan(0);
 await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>amount(page),{intervals:[20],timeout:500}).toBe(0);
});

test('standard 6x3 pitched acrylic keeps orbit responsive during repeated toggles',async({page})=>{
 await openDesign(page,1440,false);
 await page.getByRole('radio',{name:'Pitched',exact:true}).check();
 await page.getByRole('textbox',{name:'Width in metres'}).fill('6.0');await page.getByRole('textbox',{name:'Width in metres'}).press('Tab');
 await page.getByRole('textbox',{name:'Projection in metres'}).fill('3.0');await page.getByRole('textbox',{name:'Projection in metres'}).press('Tab');
 await page.getByRole('radio',{name:'Attached to house',exact:true}).check();
 await page.getByRole('radio',{name:'Facade',exact:true}).check();
 await page.getByRole('button',{name:/^Personalise(?: your pergola)? →$/}).click();
 await page.getByRole('button',{name:/^Lighting /}).click();
 await page.getByRole('button',{name:/^Rafter lights/}).click();await page.getByRole('button',{name:/^Medium/}).click();
 await page.getByRole('button',{name:/^LED strips/}).click();await page.getByRole('button',{name:'Outer perimeter',exact:true}).click();
 const canvas=page.locator('canvas');await page.waitForTimeout(1000);
 const before=await canvas.getAttribute('data-camera'),box=(await canvas.boundingBox())!;
 await mood(page,'Night').click();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55,{steps:12});await page.mouse.up();
 expect(await canvas.getAttribute('data-camera')).not.toBe(before);
 for(const target of ['Day','Night','Day','Night','Day']){await mood(page,target).click();await page.waitForTimeout(70);}
 await expect.poll(()=>amount(page)).toBe(0);
 const orbit=await canvas.getAttribute('data-camera');
 await mood(page,'Night').click();await expect.poll(()=>amount(page)).toBe(1);
 expect(await canvas.getAttribute('data-camera')).toBe(orbit);
 await page.screenshot({path:`${evidence}/pitched-rafter-strips-night.png`});
 await mood(page,'Day').click();await expect.poll(()=>amount(page)).toBe(0);
 expect(await canvas.getAttribute('data-camera')).toBe(orbit);
});
