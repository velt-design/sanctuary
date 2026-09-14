'use client';
import { getBlindPricingBands, getDefaultInstalledSellingRates, type CostingControlConfigV1 } from '@sp/costing';
import { NumberField } from './CostingControlEditors';
import { findIssue, type ValidationIssue } from './costingControlModel';
import styles from './costingControl.module.css';

type Props = { config: CostingControlConfigV1; baseline: CostingControlConfigV1; readOnly: boolean;
  showChangedOnly: boolean; issues: ValidationIssue[]; updateConfig: (mutate: (next: CostingControlConfigV1) => void) => void };
function read(value: unknown, path: string[]): number | undefined {
  for (const key of path) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  return typeof value === 'number' ? value : undefined;
}
function write(value: unknown, path: string[], amount: number) {
  const [key, ...rest] = path;
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (rest.length) write(record[key], rest, amount); else record[key] = amount;
}
const fields = [
  ['blinds.coreSellMultiplier', 'Blind core selling multiplier', 'factor'],
  ['blinds.fabricMultipliers.MESH', 'Mesh fabric multiplier', 'factor'],
  ['blinds.fabricMultipliers.PVC', 'PVC fabric multiplier', 'factor'],
  ['blinds.fabricMultipliers.FINE_MESH', 'Fine mesh fabric multiplier', 'factor'],
  ['blinds.motorIncCents', 'Blind motor add-on', '$ incl. GST'],
  ['blinds.coverIncCentsPerM.FLASHING', 'Blind flashing per metre', '$ incl. GST'],
  ['blinds.coverIncCentsPerM.PELMET', 'Blind flashing and pelmet per metre', '$ incl. GST'],
  ['rafterLighting.startupIncCents', 'Rafter lighting startup', '$ incl. GST'],
  ['rafterLighting.lightIncCents', 'Each rafter light, installed', '$ incl. GST'],
  ['rafterLighting.dimmerIncCents', 'Rafter lighting dimmer', '$ incl. GST'],
  ['rafterLighting.extraDriverIncCents', 'Additional lighting driver', '$ incl. GST'],
  ['rafterLighting.standardDriverCapacity', 'Lights per standard driver', 'lights'],
  ['rafterLighting.dimmedDriverCapacity', 'Lights per dimmed driver', 'lights'],
] as const;

export default function InstalledSellingRatesEditor(props: Props) {
  const { config, baseline, readOnly, updateConfig, showChangedOnly, issues } = props;
  const rates = config.installedSellingRates;
  if (!rates) return <section><h2>Installed selling schedules</h2>
    <p>This version has no saved Ziptrak, Omni or rafter-light schedule. Capture the existing portal rates to review them in this draft. Existing published versions stay unchanged.</p>
    {!readOnly && <button className={styles.buttonSecondary} type="button" onClick={() => updateConfig(next => { next.installedSellingRates = getDefaultInstalledSellingRates(); })}>Add installed selling schedules to this draft</button>}
  </section>;
  return <section><h2>Installed selling schedules</h2>
    <p>Installation is already included. These schedules do not receive another installation charge or the pergola selling multiplier. Uncovered blinds have no cover charge. Capturing rates does not activate public pricing.</p>
    <p className={styles.warning}>Prepared for configurator rollout. Saving or publishing these fields does not yet change the legacy staff calculator's installed schedules.</p>
    {(['ZIPTRAK', 'OMNI'] as const).map(system => {
      const key = system === 'ZIPTRAK' ? 'ziptrakBaseExGst' : 'omniBaseExGst';
      const bands = getBlindPricingBands(system);
      return <details key={system}><summary>{system === 'ZIPTRAK' ? 'Ziptrak' : 'Omni'} base schedule</summary>
        <p>Base NZD excluding GST, before the fabric and blind core multipliers. Columns are maximum width; rows are maximum drop. Dimensions are millimetres.</p>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Drop / width</th>{bands.widthsMm.map(width => <th key={width}>{width}</th>)}</tr></thead><tbody>
          {bands.dropsMm.map((drop, row) => <tr key={drop}><th>{drop}</th>{bands.widthsMm.map((width, col) => {
            const path = ['blinds', key, String(row), String(col)], fullPath = `installedSellingRates.${path.join('.')}`;
            const amount = rates.blinds[key][row][col], previous = read(baseline.installedSellingRates, path), issue = findIssue(issues, fullPath);
            return <td key={width}>{showChangedOnly && amount === previous ? <span>{amount.toFixed(2)}</span> : <>
              <input type="number" min="0.01" step="0.01" className={styles.input} aria-label={`${system} ${width} wide ${drop} drop base ex GST`} disabled={readOnly} value={amount} aria-invalid={Boolean(issue)} onChange={event => { const value = event.currentTarget.valueAsNumber; updateConfig(next => write(next.installedSellingRates, path, value)); }} />
              <small>Active: {previous === undefined ? 'not present' : previous.toFixed(2)}</small>
              {previous !== undefined && amount !== previous && !readOnly && <button type="button" className={styles.textButton} onClick={() => updateConfig(next => write(next.installedSellingRates, path, previous))}>Reset</button>}
              {issue && <div className={styles.fieldError} role="alert">{issue.message}</div>}
            </>}</td>;
          })}</tr>)}
        </tbody></table></div>
      </details>;
    })}
    <div className={styles.fieldGrid}>{fields.map(([key, label, unit]) => {
      const path = key.split('.'), fullPath = `installedSellingRates.${key}`, value = read(rates, path)!;
      const previous = read(baseline.installedSellingRates, path), divisor = unit.startsWith('$') ? 100 : 1;
      if (showChangedOnly && value === previous) return null;
      return <NumberField key={key} path={fullPath} metadata={{ label, unit, min: unit.startsWith('$') ? 0 : 0.01, max: unit === 'factor' ? 5 : unit === 'lights' ? 1000 : 1_000_000, step: unit === 'lights' ? 1 : 0.01, description: unit.startsWith('$') ? 'Installed customer selling amount, including GST.' : 'Applied within the installed selling schedule.' }}
        value={value / divisor} baselineValue={previous === undefined ? undefined : previous / divisor} disabled={readOnly} issue={findIssue(issues, fullPath)}
        onChange={amount => updateConfig(next => write(next.installedSellingRates, path, divisor === 100 ? Math.round(amount * 100) : amount))}
        onReset={() => { if (previous !== undefined) updateConfig(next => write(next.installedSellingRates, path, previous)); }} />;
    })}</div>
  </section>;
}
