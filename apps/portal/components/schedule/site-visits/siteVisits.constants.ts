// 95% of prior 64.8px hour height (global scale)
export const HOUR_HEIGHT_PX = 61.56;
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 20; // 8pm
export const START_SCROLL_HOUR = 8;
export const WORK_START_HOUR = 6;
export const WORK_END_HOUR = 20; // 8pm
export const MINUTES_STEP = 15;
export const DEFAULT_DURATION_MINUTES = 30;

export const DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const SLOT_HEIGHT_PX = HOUR_HEIGHT_PX / (60 / MINUTES_STEP);
