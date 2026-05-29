import { describe, expect, it } from 'vitest';
import {
  SIDEBAR_LABEL_PANEL_WIDTH_PX,
  SIDEBAR_PINNED_WIDTH_PX,
  SIDEBAR_RAIL_WIDTH_PX,
} from './sidebarLayout';

describe('sidebarLayout', () => {
  it('keeps pinned width equal to rail plus label panel', () => {
    expect(SIDEBAR_RAIL_WIDTH_PX).toBe(48);
    expect(SIDEBAR_LABEL_PANEL_WIDTH_PX).toBe(160);
    expect(SIDEBAR_PINNED_WIDTH_PX).toBe(SIDEBAR_RAIL_WIDTH_PX + SIDEBAR_LABEL_PANEL_WIDTH_PX);
  });
});

