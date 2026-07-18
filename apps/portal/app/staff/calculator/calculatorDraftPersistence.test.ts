import { describe, expect, it, vi } from 'vitest';
import { makeDefaultCalculatorInputs, type CalculatorDraftSessionSnapshot } from './calculatorInputs';
import { createCalculatorDraftPersistence, type CalculatorDraftPersistenceServices } from './calculatorDraftPersistence';

function makeSnapshot(activeModuleIndex = 0): CalculatorDraftSessionSnapshot {
  return {
    activeModuleIndex,
    updatedAt: 1,
    values: makeDefaultCalculatorInputs(),
  };
}

function makeSessionStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

function makeServices(
  overrides: Partial<CalculatorDraftPersistenceServices> = {},
): CalculatorDraftPersistenceServices {
  const sessionStorage = makeSessionStorage();
  return {
    ensureStoreReady: vi.fn().mockResolvedValue(undefined),
    readWorkingCopy: vi.fn().mockReturnValue(null),
    writeWorkingCopy: vi.fn().mockResolvedValue(undefined),
    getSessionStorage: vi.fn(() => sessionStorage),
    ...overrides,
  };
}

describe('calculatorDraftPersistence', () => {
  it('prefers a valid working copy over session storage', async () => {
    const workingCopy = makeSnapshot(1);
    const sessionCopy = makeSnapshot(0);
    const sessionStorage = makeSessionStorage({ draft: JSON.stringify(sessionCopy) });
    const persistence = createCalculatorDraftPersistence(
      makeServices({
        readWorkingCopy: vi.fn(() => workingCopy),
        getSessionStorage: vi.fn(() => sessionStorage),
      }),
    );

    await expect(persistence.restore({ entityKey: 'entity', sessionKey: 'draft' })).resolves.toEqual({
      snapshot: workingCopy,
      source: 'working-copy',
    });
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
  });

  it('falls back to session storage when the working-copy store is unavailable', async () => {
    const sessionCopy = makeSnapshot(1);
    const sessionStorage = makeSessionStorage({ draft: JSON.stringify(sessionCopy) });
    const persistence = createCalculatorDraftPersistence(
      makeServices({
        ensureStoreReady: vi.fn().mockRejectedValue(new Error('IndexedDB blocked')),
        getSessionStorage: vi.fn(() => sessionStorage),
      }),
    );

    await expect(persistence.restore({ entityKey: 'entity', sessionKey: 'draft' })).resolves.toEqual({
      snapshot: sessionCopy,
      source: 'session',
    });
  });

  it('removes malformed session data and returns no draft', async () => {
    const sessionStorage = makeSessionStorage({ draft: '{bad json' });
    const persistence = createCalculatorDraftPersistence(
      makeServices({ getSessionStorage: vi.fn(() => sessionStorage) }),
    );

    await expect(persistence.restore({ entityKey: 'entity', sessionKey: 'draft' })).resolves.toBeNull();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('draft');
  });

  it.each([
    { sessionFails: false, workingCopyFails: true, expected: { sessionStored: true, workingCopyStored: false } },
    { sessionFails: true, workingCopyFails: false, expected: { sessionStored: false, workingCopyStored: true } },
    { sessionFails: true, workingCopyFails: true, expected: { sessionStored: false, workingCopyStored: false } },
  ])('reports each local persistence outcome %#', async ({ sessionFails, workingCopyFails, expected }) => {
    const sessionStorage = makeSessionStorage();
    if (sessionFails) sessionStorage.setItem.mockImplementation(() => {
      throw new Error('Session storage blocked');
    });
    const persistence = createCalculatorDraftPersistence(
      makeServices({
        getSessionStorage: vi.fn(() => sessionStorage),
        writeWorkingCopy: workingCopyFails
          ? vi.fn().mockRejectedValue(new Error('Working copy failed'))
          : vi.fn().mockResolvedValue(undefined),
      }),
    );

    await expect(
      persistence.persist({ entityKey: 'entity', sessionKey: 'draft', snapshot: makeSnapshot() }),
    ).resolves.toEqual(expected);
  });
});
