'use client';

import type { RailFieldDefinition } from './RailFieldTypes';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { ToggleField } from './ToggleField';

export function renderRailField(field: RailFieldDefinition) {
  if (field.kind === 'toggle') {
    return <ToggleField key={field.id} {...field} />;
  }

  if (field.kind === 'select') {
    return <SelectField key={field.id} {...field} />;
  }

  return <NumberField key={field.id} {...field} />;
}
