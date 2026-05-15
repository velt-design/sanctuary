import { describe, expect, it } from 'vitest';
import type { BlindLineItem } from '@/lib/types/calculator';
import {
  buildBlindInputs,
  buildCalculatorBlindsUi,
  formatBlindMetresInput,
  parseBlindMetresInputToMmString,
} from './calculatorBlindUi';

function makeBlind(overrides?: Partial<BlindLineItem>): BlindLineItem {
  return {
    id: 'blind-1',
    label: 'Kitchen blind',
    system: 'OMNI',
    widthMm: '2000',
    coverLengthMm: '2000',
    fabric: 'MESH',
    motorised: 'NONE',
    ...overrides,
  };
}

describe('calculator blind UI helpers', () => {
  it('formats stored millimetres for metre-based calculator inputs', () => {
    expect(formatBlindMetresInput('2000')).toBe('2');
    expect(formatBlindMetresInput('2400')).toBe('2.4');
    expect(formatBlindMetresInput('2403')).toBe('2.403');
    expect(formatBlindMetresInput('')).toBe('');
  });

  it('parses metre input strings back into stored millimetres', () => {
    expect(parseBlindMetresInputToMmString('2.4')).toBe('2400');
    expect(parseBlindMetresInputToMmString('2.403')).toBe('2403');
    expect(parseBlindMetresInputToMmString('')).toBe('');
    expect(parseBlindMetresInputToMmString('bad')).toBe('');
  });

  it('maps valid calculator blind fields to pricing inputs', () => {
    expect(buildBlindInputs([makeBlind({ system: 'ZIPTRAK', fabric: 'PVC', motorised: 'YES' })])).toEqual([
      {
        id: 'blind-1',
        label: 'Kitchen blind',
        system: 'ZIPTRAK',
        widthMm: 2000,
        coverLengthMm: 2000,
        fabric: 'PVC',
        motorised: true,
      },
    ]);
  });

  it('maps blank and invalid dimensions to null and non-YES motorised values to null', () => {
    expect(
      buildBlindInputs([
        makeBlind({ id: 'blank', widthMm: '', coverLengthMm: 'bad', motorised: 'NONE' }),
        makeBlind({
          id: 'not-yes',
          widthMm: '1200',
          coverLengthMm: '1400',
          motorised: 'NO' as unknown as BlindLineItem['motorised'],
        }),
      ]),
    ).toMatchObject([
      { id: 'blank', widthMm: null, coverLengthMm: null, motorised: null },
      { id: 'not-yes', widthMm: 1200, coverLengthMm: 1400, motorised: null },
    ]);
  });

  it('builds missing-dimensions status text as helper copy', () => {
    const ui = buildCalculatorBlindsUi([makeBlind({ widthMm: '', coverLengthMm: '' })]);

    expect(ui.rows[0]).toMatchObject({
      isPriceable: false,
      showStatus: true,
      statusMessage: 'Enter dimensions to price this blind.',
      statusTone: 'helper',
      totalExLabel: '—',
      totalIncLabel: '—',
    });
  });

  it('builds max-width status text as error copy', () => {
    const ui = buildCalculatorBlindsUi([makeBlind({ system: 'OMNI', widthMm: '4600', coverLengthMm: '2000' })]);

    expect(ui.rows[0]).toMatchObject({
      isPriceable: false,
      showStatus: true,
      statusMessage: 'Add another blind and keep each width within 4.5m.',
      statusTone: 'error',
    });
  });

  it('builds max-cover-length status text as error copy', () => {
    const ui = buildCalculatorBlindsUi([makeBlind({ system: 'OMNI', widthMm: '3000', coverLengthMm: '3001' })]);

    expect(ui.rows[0]).toMatchObject({
      isPriceable: false,
      showStatus: true,
      statusMessage: 'Manual quote required above 3m cover length.',
      statusTone: 'error',
    });
  });

  it('builds price labels and summary text for valid blinds', () => {
    const ui = buildCalculatorBlindsUi([makeBlind()]);

    expect(ui.summaryText).toBe('1 blind · totals update live');
    expect(ui.rows[0]).toMatchObject({
      isPriceable: true,
      showStatus: false,
      statusMessage: '',
      totalExLabel: '$1347.83',
      totalIncLabel: '$1550.00',
    });
    expect(ui.totalEx).toBe(1347.83);
    expect(ui.totalInc).toBe(1550);
    expect(ui.totalExLabel).toBe('$1347.83');
    expect(ui.totalIncLabel).toBe('$1550.00');
  });

  it('excludes invalid blinds from aggregate totals through pricing behavior', () => {
    const ui = buildCalculatorBlindsUi([
      makeBlind({ id: 'valid' }),
      makeBlind({ id: 'invalid', system: 'OMNI', widthMm: '4600', coverLengthMm: '2000' }),
    ]);

    expect(ui.summaryText).toBe('2 blinds · totals update live');
    expect(ui.pricing.items.find((item) => item.id === 'invalid')?.errors.length).toBeGreaterThan(0);
    expect(ui.totalExLabel).toBe('$1347.83');
    expect(ui.totalIncLabel).toBe('$1550.00');
  });
});
