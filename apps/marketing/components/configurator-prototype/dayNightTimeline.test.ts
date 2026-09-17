import { describe, expect, it } from 'vitest';
import { sampleDayNight, DAY_NIGHT_DURATION_MS } from './dayNightTimeline';

describe('day/night timeline', () => {
  it('stays bounded and reaches exact endpoints in either direction', () => {
    for (const [from,target] of [[0,1],[1,0]]) {
      const transition = {from,target,startedAt:100};
      expect(sampleDayNight(transition,0)).toBe(from);
      expect(sampleDayNight(transition,100+DAY_NIGHT_DURATION_MS)).toBe(target);
      expect(sampleDayNight(transition,100+DAY_NIGHT_DURATION_MS/2)).toBe(.5);
      expect(sampleDayNight(transition,100000)).toBe(target);
    }
  });
  it('reverses from its current appearance and obeys reduced motion', () => {
    const value=sampleDayNight({from:0,target:1,startedAt:0},350);
    const reverse={from:value,target:0,startedAt:350};
    expect(sampleDayNight(reverse,350)).toBe(value);
    expect(sampleDayNight(reverse,550)).toBeLessThan(value);
    expect(sampleDayNight(reverse,550,true)).toBe(0);
  });
});
