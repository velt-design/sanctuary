'use client';
import { ACCESSORY_REVIEW_RATES, type AccessoryRates, type CostingControlConfigV1 } from '@sp/costing';
import { NumberField } from './CostingControlEditors';
import { findIssue, type ValidationIssue } from './costingControlModel';
import styles from './costingControl.module.css';

const labels: Record<keyof AccessoryRates, string> = {
  thermopineSupplyPerM: 'ThermoPine supply', timberSupplyPerM: 'Cedar supply', aluminiumSupplyPerM: 'Aluminium slat supply',
  selectedTimberLengthFactor: 'Selected timber length factor', wasteFactor: 'Waste factor', timberCoatingPerM: 'Timber coating per metre',
  aluminiumFitPerM: 'Aluminium fitting per metre', timberLabourPerHour: 'Timber labour per hour', timberCutMinutes: 'Minutes per timber cut',
  timberFixMinutes: 'Minutes per timber fixing', timberSetupHours: 'Timber setup hours', timberFixingsPerPoint: 'Fixings per attachment point',
  frameSupplyAndFitPerM: 'Frame supply and fitting per metre', plateSupplyAndFitPerM: 'Plate supply and fitting per metre',
  upgradedFrameExtraPerM: 'Frame upgrade extra per metre', panelSetup: 'Aluminium panel setup', cedarLightSupplyAndFitEach: 'Ceiling downlight supply and fitting',
  ledSupplyChannelAndFitPerM: 'LED strip, channel and fitting per metre', ledDriverPerRun: 'LED driver per run', electricalConnection: 'Shared electrical connection',
};

export default function AccessoryRatesEditor({ config, baseline, readOnly, showChangedOnly, issues, updateConfig }: {
  config: CostingControlConfigV1; baseline: CostingControlConfigV1; readOnly: boolean; showChangedOnly: boolean; issues: ValidationIssue[];
  updateConfig: (mutate: (next: CostingControlConfigV1) => void) => void;
}) {
  const rates = config.accessoryRates;
  if (!rates) return <section>
    <h2>Accessory allowances</h2><p>This version has no accessory catalogue. Adding the review allowances creates editable draft data; it does not enable public pricing.</p>
    <p>Supplier evidence still needs review. Ziptrak and rafter lights use separate installed selling schedules and must not receive a second installation charge.</p>
    {!readOnly && <button type="button" className={styles.buttonSecondary} onClick={() => updateConfig(next => { next.accessoryRates = structuredClone(ACCESSORY_REVIEW_RATES); })}>Add review allowances to this draft</button>}
  </section>;
  return <section><h2>Accessory allowances</h2>
    <p>Money values exclude GST. Review supply, selected lengths, coating and fitting together to avoid charging twice. These fields are versioned with this pricebook; public configurator activation remains a separate release.</p>
    {Object.entries(rates).flatMap(([rawKey, value]) => {
      const key = rawKey as keyof AccessoryRates;
      return (typeof value === 'number' ? [[null, value] as const] : Object.entries(value)).map(([profile, amount]) => {
        const path = `accessoryRates.${key}${profile ? `.${profile}` : ''}`;
        const baselineGroup = baseline.accessoryRates?.[key];
        const baselineValue = typeof baselineGroup === 'number' ? baselineGroup : profile && baselineGroup ? baselineGroup[profile as keyof typeof baselineGroup] : undefined;
        if (showChangedOnly && baselineValue === amount) return null;
        const factor = key.endsWith('Factor'), time = key.includes('Minutes') || key.includes('Hours');
        return <NumberField key={path} path={path} metadata={{ label: `${labels[key]}${profile ? ` · ${profile} mm / metre` : ''}`, description: baselineValue === undefined ? 'New allowance; not present in the active version.' : '', unit: factor ? '×' : time ? key.includes('Minutes') ? 'minutes' : 'hours' : '$ ex GST', min: factor ? 1 : 0, max: factor ? 5 : 100_000, step: .01 }}
          value={amount} baselineValue={baselineValue} disabled={readOnly} issue={findIssue(issues,path)}
          onChange={nextValue => updateConfig(next => { const target = next.accessoryRates! as unknown as Record<string, number | Record<string,number>>; if (profile) (target[key] as Record<string,number>)[profile] = nextValue; else target[key] = nextValue; })}
          onReset={() => updateConfig(next => { if (baselineValue === undefined) return; const target = next.accessoryRates! as unknown as Record<string, number | Record<string,number>>; if (profile) (target[key] as Record<string,number>)[profile] = baselineValue; else target[key] = baselineValue; })} />;
      });
    })}
  </section>;
}
