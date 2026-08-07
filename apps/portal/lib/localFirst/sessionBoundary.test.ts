import { describe, expect, it } from 'vitest';
import {
  calculatorSessionStorageKey,
  clearCalculatorSessionDraftsForOwner,
  clearLegacyUnscopedCalculatorSessionDrafts,
} from './sessionBoundary';

describe('portal session-storage owner boundary', () => {
  it('builds a physical session key owned by the authenticated user', () => {
    const logicalKey = 'sanctuary-portal:calculator:draft:v1:project-1:new';
    expect(calculatorSessionStorageKey('user-a', logicalKey)).toBe(
      'sanctuary-portal:calculator:draft:v2:user-a:project-1:new',
    );
    expect(calculatorSessionStorageKey('user-b', logicalKey)).not.toBe(calculatorSessionStorageKey('user-a', logicalKey));
  });

  it('removes only legacy unscoped calculator drafts', () => {
    const values = new Map<string, string>([
      ['sanctuary-portal:calculator:draft:v1:project-a:edit:estimate-a', 'private-a'],
      ['sanctuary-portal:calculator:uiMode:v1', 'advanced'],
      ['unrelated', 'keep'],
    ]);
    const storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
    };

    expect(clearLegacyUnscopedCalculatorSessionDrafts(storage)).toBe(1);
    expect(values.has('sanctuary-portal:calculator:draft:v1:project-a:edit:estimate-a')).toBe(false);
    expect(values.get('sanctuary-portal:calculator:uiMode:v1')).toBe('advanced');
    expect(values.get('unrelated')).toBe('keep');
  });

  it('clears only the departing owner calculator drafts', () => {
    const values = new Map<string, string>([
      ['sanctuary-portal:calculator:draft:v2:user-a:project-a:new', 'private-a'],
      ['sanctuary-portal:calculator:draft:v2:user-b:project-b:new', 'private-b'],
      ['sanctuary-portal:calculator:uiMode:v1', 'advanced'],
    ]);
    const storage = {
      get length() {
        return values.size;
      },
      key(index: number) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key: string) {
        values.delete(key);
      },
    };

    expect(clearCalculatorSessionDraftsForOwner('user-a', storage)).toBe(1);
    expect(values.has('sanctuary-portal:calculator:draft:v2:user-a:project-a:new')).toBe(false);
    expect(values.get('sanctuary-portal:calculator:draft:v2:user-b:project-b:new')).toBe('private-b');
    expect(values.get('sanctuary-portal:calculator:uiMode:v1')).toBe('advanced');
  });
});
