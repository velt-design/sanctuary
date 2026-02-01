import { describe, expect, it } from 'vitest';
import { parseContactsCsv, planContactsImport } from './contactsCsv';

describe('parseContactsCsv', () => {
  it('detects header row even with leading junk rows', () => {
    const csv = [
      ',oliphant,,,',
      'Date of inquiry,Client name,Phone number,Address,Email Address',
      ',Richard Pryor ,0212886411,"47 Sunnyhaven Ave, Beachlands",sunnyhaven@outlook.com',
    ].join('\n');

    const res = parseContactsCsv(csv);
    expect(res.headerRowNumber).toBe(2);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].displayName).toBe('Richard Pryor');
    expect(res.rows[0].email).toBe('sunnyhaven@outlook.com');
    expect(res.rows[0].phone).toBe('0212886411');
  });
});

describe('planContactsImport', () => {
  it('dedupes by email and optionally merges blanks', () => {
    const parsed = parseContactsCsv(
      [
        'Name,Email,Phone',
        'Alice,alice@example.com,',
        'Bob,bob@example.com,021',
      ].join('\n'),
    );

    const existing = [
      {
        id: 'ct_1',
        displayName: 'Alice Existing',
        email: 'alice@example.com',
        phone: '',
        createdAt: 'now',
        updatedAt: 'now',
      },
    ];

    const noMerge = planContactsImport(parsed.rows, existing, { mergeBlanks: false });
    expect(noMerge.stats.create).toBe(1);
    expect(noMerge.stats.skip).toBe(1);
    expect(noMerge.decisions.find((d) => d.row.displayName === 'Alice')?.action).toBe('skip');

    const merge = planContactsImport(parsed.rows, existing, { mergeBlanks: true });
    expect(merge.stats.merge).toBe(0); // no new data to merge for Alice
    expect(merge.stats.create).toBe(1);
  });
});

