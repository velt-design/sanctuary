import {test,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
for(const width of [390,1440])test('lighting mode, fixtures, selection and saved design at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/configurator-preview');await page.getByRole('button',{name:'Essential only',exact:true}).click();await page.getByRole('button',{name:'Design your pergola',exact:false}).click();
 const canvas=page.locator('canvas');await expect(canvas).toHaveAttribute('data-camera',/perspective/);const camera=await canvas.getAttribute('data-camera');
 await page.getByRole('button',{name:'Lighting · Set the mood ↗'}).click();const c=page.getByRole('region',{name:'Lighting editor'});
 await expect(page.locator('[data-night]')).toHaveAttribute('data-night','true');await expect(page.getByRole('textbox',{name:'Width in metres'})).toHaveCount(0);for(const [i,v] of JSON.parse(camera!).position.entries())expect(JSON.parse((await canvas.getAttribute('data-camera'))!).position[i]).toBeCloseTo(v,3);
 await c.getByRole('spinbutton',{name:'rafter light quantity'}).fill('6');await expect(page.locator('[data-light-rafter-count]')).toHaveAttribute('data-light-rafter-count','6');
 await c.getByRole('radio',{name:'Central',exact:true}).check();await c.getByRole('button',{name:'Outer perimeter',exact:true}).click();await expect(page.locator('[data-light-strip-count]')).not.toHaveAttribute('data-light-strip-count','0');
 await c.getByRole('button',{name:'Day',exact:true}).click();await expect(page.locator('[data-night]')).toHaveAttribute('data-night','false');for(const [i,v] of JSON.parse(camera!).position.entries())expect(JSON.parse((await canvas.getAttribute('data-camera'))!).position[i]).toBeCloseTo(v,3);
 await c.getByRole('button',{name:'Night',exact:true}).click();
 // Select the exposed front beam, then ensure an orbit drag does not toggle it.
 const before=await page.locator('[data-light-strip-count]').getAttribute('data-light-strip-count');const state=JSON.parse(camera!);const bounds=(await canvas.boundingBox())!;
 const cam=new PerspectiveCamera(state.fov,bounds.width/bounds.height,10,200000);cam.position.fromArray(state.position);cam.up.set(0,0,1);cam.lookAt(new Vector3().fromArray(state.target));cam.updateMatrixWorld();
 const hit=new Vector3(1400,3000,2460).project(cam);const x=bounds.x+(hit.x+1)*bounds.width/2,y=bounds.y+(1-hit.y)*bounds.height/2;
 await page.mouse.click(x,y);await expect(page.locator('[data-light-strip-count]')).not.toHaveAttribute('data-light-strip-count',before!);
 const after=await page.locator('[data-light-strip-count]').getAttribute('data-light-strip-count');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y+30,{steps:10});await page.mouse.up();await expect(page.locator('[data-light-strip-count]')).toHaveAttribute('data-light-strip-count',after!);
 await page.screenshot({path:'artifacts/configurator-preview/lighting-night-'+width+'.png'});
 await c.getByRole('button',{name:'← Done with lighting'}).click();await expect(page.locator('[data-night]')).toHaveAttribute('data-night','false');await expect(page.getByRole('textbox',{name:'Width in metres'})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Design your pergola',exact:false}).click();await page.getByRole('button',{name:'Lighting · Set the mood ↗'}).click();await expect(c.getByRole('spinbutton',{name:'rafter light quantity'})).toHaveValue('6');await c.getByRole('button',{name:'← Done with lighting'}).click();
 await page.getByRole('radio',{name:'Solid',exact:true}).check();await page.getByRole('button',{name:'Lighting · Set the mood ↗'}).click();await c.getByRole('spinbutton',{name:'cedar light quantity'}).fill('4');await expect(page.locator('[data-light-cedar-count]')).toHaveAttribute('data-light-cedar-count','4');
 await c.getByRole('button',{name:'← Done with lighting'}).click();await page.getByRole('link',{name:'Continue with this design',exact:true}).click();await page.getByText('Details',{exact:true}).click();await expect(page.getByText(/Warm-white lighting:.*4 cedar downlights/).last()).toBeVisible();expect(errors).toEqual([]);
});
