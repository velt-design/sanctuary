/** Structural side identity only. Availability remains a solved-opening decision. */
export const isSideOpeningId = (value: unknown): value is string =>
  typeof value === 'string' && /^(front|left|right|rear)-[1-9]of[1-9]$/.test(value);
