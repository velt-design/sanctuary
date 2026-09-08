import { describe, expect, it } from 'vitest';
import { createScheduleOpsFixture } from './fixtures';
import { recomputePreviewSchedule } from './previewSchedule';

describe('interactive sample Schedule', () => {
  it('starts with sequential working-day jobs instead of overlapping sample dates', () => {
    const fixture = createScheduleOpsFixture('standard');
    for (const rows of fixture.laneItems.values()) {
      expect(rows[1].forecastStart! >= rows[0].forecastEndExclusive!).toBe(true);
    }
  });

  it('reflows flexible work after extending a fixed bar without changing the original sample', () => {
    const fixture = createScheduleOpsFixture('standard');
    const lanes = new Map(fixture.laneItems);
    const [first, second] = lanes.get('fixture-crew-2')!;
    lanes.set('fixture-crew-2', [{ ...first, mode: 'pinned', forecastDurationDays: 7 }, second]);
    const result = recomputePreviewSchedule(lanes, fixture.installers, fixture.today);
    const updated = result.scheduleItemById.get(first.id)!;
    expect(updated.forecastStart).toBe(first.forecastStart);
    expect(updated.forecastDurationDays).toBe(7);
    expect(result.scheduleItemById.get(second.id)!.forecastStart! >= updated.forecastEndExclusive!).toBe(true);
    expect(fixture.scheduleItemById.get(first.id)!.forecastDurationDays).toBe(2);
  });

  it('recalculates crew dates after a Board move and retains actual starts', () => {
    const fixture = createScheduleOpsFixture('standard');
    const lanes = new Map(fixture.laneItems);
    const moving = lanes.get('fixture-crew-2')![0];
    lanes.set('fixture-crew-2', lanes.get('fixture-crew-2')!.slice(1));
    lanes.set('fixture-crew-1', [...lanes.get('fixture-crew-1')!, { ...moving, installerId: 'fixture-crew-1' }]);
    const result = recomputePreviewSchedule(lanes, fixture.installers, fixture.today);
    const destination = result.laneItems.get('fixture-crew-1')!;
    expect(destination[2].forecastStart! >= destination[1].forecastEndExclusive!).toBe(true);
    expect(destination[0].forecastStart).toBe(destination[0].actualStartDate);
    expect(result.scheduleItemById.get(moving.id)!.installerId).toBe('fixture-crew-1');
  });
});
