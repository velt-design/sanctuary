'use client';

import type { RailFieldDefinition } from './RailFieldTypes';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { ToggleField } from './ToggleField';

/*
 * PR-T6 (2026-05-26): centralised label-cleanup for number fields whose
 * legacy labels carry `(m)` / `(mm)` / `(deg)` suffixes. The CAD mockup
 * puts units with the value, not the label — "Roof span" + "7.04 m"
 * reads cleaner than "Roof span (m) 7.04". Doing this in one place means
 * the ~20 field defs across SanctuaryWorkbenchRail don't each need to be
 * edited; declarative labels stay readable in source while the renderer
 * reformats for display.
 *
 * Auto-extraction only kicks in when the field doesn't already specify
 * a `unit` — explicit always wins.
 */
const LABEL_UNIT_PATTERN = /^(.*) \((m|mm|cm|deg)\)$/;

function autoExtractUnit(
  field: Extract<RailFieldDefinition, { kind: 'number' }>,
): Extract<RailFieldDefinition, { kind: 'number' }> {
  if (field.unit) return field;
  const match = LABEL_UNIT_PATTERN.exec(field.label);
  if (!match) return field;
  const [, baseLabel, unit] = match;
  return { ...field, label: baseLabel!, unit: unit === 'deg' ? '°' : unit };
}

export function renderRailField(field: RailFieldDefinition) {
  if (field.kind === 'toggle') {
    return <ToggleField key={field.id} {...field} />;
  }

  if (field.kind === 'select') {
    return <SelectField key={field.id} {...field} />;
  }

  return <NumberField key={field.id} {...autoExtractUnit(field)} />;
}
