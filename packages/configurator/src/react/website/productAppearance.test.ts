import {describe, expect, it} from 'vitest';
import {acrylicAppearance, frameAppearance} from './productAppearance';

describe('configured product appearance', () => {
 it('retains the clear appearance and gives every tint a distinct material', () => {
   expect(acrylicAppearance(undefined,{studio:true})).toEqual(acrylicAppearance('clear',{studio:true}));
   expect(acrylicAppearance('clear',{studio:true})).toEqual({color:'#b6cbd1',opacity:.2,roughness:.09});
   expect(new Set(['clear','opal','light_grey','dark_grey'].map(tint=>JSON.stringify(acrylicAppearance(tint as 'clear')))).size).toBe(4);
 });
 it('retains the existing dark structural material unless white is selected', () => {
   expect(frameAppearance(undefined)).toBeNull();
   expect(frameAppearance('black')).toBeNull();
   expect(frameAppearance('white')).toBe('#e8e7df');
 });
});
