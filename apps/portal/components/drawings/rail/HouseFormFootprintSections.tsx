import type { ReactNode } from 'react';
import type { FieldErrors } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

type BuildHouseFormFootprintSectionsInput = {
  fieldErrors: FieldErrors;
};

export function buildHouseFormFootprintSections({
  fieldErrors,
}: BuildHouseFormFootprintSectionsInput): ReactNode[] {
  const fields: ReactNode[] = [];
  if (fieldErrors.outline) {
    fields.push(
      <p key="outline-error" className={styles.fieldError}>
        {fieldErrors.outline}
      </p>,
    );
  }
  return fields;
}
