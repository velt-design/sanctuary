import { expect, it } from 'vitest';
import { dayNightTheme } from './dayNightTheme';
const channels=(value:string)=>value.match(/[\d.]+/g)!.map(Number);
const luminance=(value:string)=>channels(value).reduce((sum,v,i)=>{const n=v/255;return sum+(n<=.04045?n/12.92:((n+.055)/1.055)**2.4)*[.2126,.7152,.0722][i];},0);
const ratio=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
it('restores the complete day and night surface endpoints',()=>{
 const day=dayNightTheme(0),night=dayNightTheme(1);
 expect(day['--color-surface-warm']).toBe('rgb(241, 240, 235)');
 expect(night['--color-surface-warm']).toBe('rgb(32, 37, 35)');
 expect(night['--color-surface-elevated']).toBe('rgb(40, 45, 43)');
 expect(night['--control-selected']).toBe('rgb(68, 78, 67)');
 expect(night['--theme-warm-primary']).toBe('rgb(243, 238, 228)');
});
it('keeps every text role readable on its own surface through both directions',()=>{
 for(let i=0;i<=1000;i++){
  const palette=dayNightTheme(i/1000);
  for(const [surface,token] of [['warm','--color-surface-warm'],['elevated','--color-surface-elevated'],['selected','--control-selected']]){
   for(const role of ['primary','secondary','subtle'])expect(ratio(palette[`--theme-${surface}-${role}`],palette[token]),`${surface}/${role} at ${i/1000}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(ratio(palette['--color-on-accent'],palette['--color-accent-olive'])).toBeGreaterThanOrEqual(4.5);
 }
});
it('uses scene progress directly with no independent easing or directional state',()=>{
 const quarter=dayNightTheme(.25),half=dayNightTheme(.5);
 expect(quarter['--night-amount']).toBe('0.25');
 expect(quarter['--color-surface-warm']).toBe('rgb(189, 189, 185)');
 expect(half['--color-surface-warm']).toBe('rgb(137, 139, 135)');
 expect(dayNightTheme(.25)).toEqual(quarter);
});
