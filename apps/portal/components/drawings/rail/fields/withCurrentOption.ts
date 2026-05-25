import type { SelectOption } from './RailFieldTypes';

/*
 * If the current value isn't represented in the canonical option list, prepend
 * a synthetic "Current: <value>" option so the select can render the
 * persisted-but-deprecated state without dropping it on the floor. Used when
 * option sets change over time (e.g. a removed roof material that still
 * exists on older estimates).
 */
export function withCurrentOption(
  options: SelectOption[],
  value: string,
  fallbackLabel: string,
): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ label: `${fallbackLabel}: ${value}`, value }, ...options];
}
