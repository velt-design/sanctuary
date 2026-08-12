'use client';

import { useQuery } from '@tanstack/react-query';

import type { AdditionalAluminiumCatalogueItem } from '@/lib/costing/additionalAluminiumCatalogue';
import type {
  CalculatorAdditionalAluminiumRow,
  CalculatorAdditionalAluminiumState,
} from '@/lib/types/calculator';
import FieldTile from './FieldTile';
import { POWDERCOAT_STANDARD_COLOURS } from './calculatorConfigurationFieldOptions';
import styles from './CalculatorAdditionalAluminiumEditor.module.css';

type CatalogueResponse = { items?: AdditionalAluminiumCatalogueItem[]; error?: string };

async function fetchCatalogue(): Promise<AdditionalAluminiumCatalogueItem[]> {
  const response = await fetch('/api/staff/costing/v1/aluminium-catalogue', { cache: 'no-store' });
  const body = (await response.json().catch(() => null)) as CatalogueResponse | null;
  if (!response.ok) throw new Error(body?.error || 'Could not load aluminium profiles.');
  return Array.isArray(body?.items) ? body.items : [];
}

type Props = {
  state: CalculatorAdditionalAluminiumState;
  catalogueItems?: AdditionalAluminiumCatalogueItem[];
  onAddRow: () => void;
  onUpdateRow: (id: string, patch: Partial<Omit<CalculatorAdditionalAluminiumRow, 'id'>>) => void;
  onRemoveRow: (id: string) => void;
  onUpdateFinish: (patch: Partial<Omit<CalculatorAdditionalAluminiumState, 'rows'>>) => void;
};

export default function CalculatorAdditionalAluminiumEditor({
  state,
  catalogueItems,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onUpdateFinish,
}: Props) {
  const catalogue = useQuery({
    queryKey: ['costing', 'additional-aluminium-catalogue'],
    queryFn: fetchCatalogue,
    enabled: catalogueItems === undefined,
    staleTime: 5 * 60 * 1000,
  });
  const items = catalogueItems ?? catalogue.data ?? [];

  return (
    <div className={styles.editor}>
      <p className={styles.intro}>
        Add unusual full aluminium bars once for this estimate. They add materials only and can be used without a pergola.
      </p>
      <div className={styles.finishFields}>
        <FieldTile
          id="additional-aluminium-finish"
          label="Aluminium finish"
          type="select"
          value={state.extrusionColour ?? 'Black'}
          options={[
            { label: 'Black', value: 'Black' },
            { label: 'White', value: 'White' },
            { label: 'Powdercoat', value: 'Mill' },
          ]}
          onChange={(value) => {
            const extrusionColour = value as NonNullable<CalculatorAdditionalAluminiumState['extrusionColour']>;
            onUpdateFinish({
              extrusionColour,
              ...(extrusionColour === 'Mill' && !state.powdercoatStandardColour
                ? { powdercoatStandardColour: POWDERCOAT_STANDARD_COLOURS[0] }
                : null),
            });
          }}
        />
        {state.extrusionColour === 'Mill' ? (
          <>
            <FieldTile
              id="additional-aluminium-powdercoat-colour"
              label="Powdercoat colour"
              type="select"
              value={state.powdercoatStandardColour ?? ''}
              disabled={state.powdercoatIsCustom === true}
              options={POWDERCOAT_STANDARD_COLOURS.map((colour) => ({ label: colour, value: colour }))}
              onChange={(value) => onUpdateFinish({ powdercoatStandardColour: String(value) })}
            />
            <FieldTile
              id="additional-aluminium-custom-powdercoat"
              label="Custom colour"
              type="toggle"
              value={state.powdercoatIsCustom === true}
              onChange={(value) => onUpdateFinish({ powdercoatIsCustom: value === true })}
            />
            {state.powdercoatIsCustom ? (
              <FieldTile
                id="additional-aluminium-custom-powdercoat-name"
                label="Custom colour name"
                type="text"
                value={state.powdercoatCustomColour ?? ''}
                onChange={(value) => onUpdateFinish({ powdercoatCustomColour: String(value) })}
                error={state.powdercoatCustomColour?.trim() ? undefined : 'Enter the custom powdercoat colour.'}
              />
            ) : null}
          </>
        ) : null}
      </div>
      <div className={styles.table}>
        <div className={styles.header} aria-hidden="true">
          <span>Profile</span>
          <span>Stock length</span>
          <span>Quantity</span>
          <span />
        </div>
        {state.rows.length === 0 ? <div className={styles.empty}>No additional aluminium added.</div> : null}
        {state.rows.map((row, index) => {
          const selected = items.find((item) => item.profile === row.profile);
          return (
            <div className={styles.row} key={row.id}>
              <select
                className={styles.control}
                aria-label={`Additional aluminium ${index + 1} profile`}
                value={row.profile}
                onChange={(event) => {
                  const profile = event.target.value;
                  const stockLengthM = items.find((item) => item.profile === profile)?.stockLengthsM[0];
                  onUpdateRow(row.id, { profile, stockLengthM: stockLengthM ? String(stockLengthM) : '' });
                }}
              >
                <option value="">Select profile</option>
                {items.map((item) => <option key={item.profile} value={item.profile}>{item.profile}</option>)}
              </select>
              <select
                className={styles.control}
                aria-label={`Additional aluminium ${index + 1} stock length`}
                value={row.stockLengthM}
                disabled={!selected}
                onChange={(event) => onUpdateRow(row.id, { stockLengthM: event.target.value })}
              >
                <option value="">Select length</option>
                {(selected?.stockLengthsM ?? []).map((lengthM) => (
                  <option key={lengthM} value={String(lengthM)}>{lengthM}m</option>
                ))}
              </select>
              <input
                className={styles.control}
                aria-label={`Additional aluminium ${index + 1} quantity`}
                type="number"
                min="1"
                max="1000"
                step="1"
                value={row.quantity}
                onChange={(event) => onUpdateRow(row.id, { quantity: event.target.value })}
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove additional aluminium ${index + 1}`}
                onClick={() => onRemoveRow(row.id)}
              >
                ×
              </button>
            </div>
          );
        })}
        {catalogue.isError ? <div className={styles.error}>{(catalogue.error as Error).message}</div> : null}
      </div>
      <button type="button" className={styles.add} onClick={() => onAddRow()} disabled={catalogue.isError}>
        Add aluminium
      </button>
    </div>
  );
}
