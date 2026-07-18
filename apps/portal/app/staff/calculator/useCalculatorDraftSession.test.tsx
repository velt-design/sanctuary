import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs, makeDefaultModule, type CalculatorDraftSessionSnapshot } from './calculatorInputs';
import type {
  CalculatorDraftPersistence,
  CalculatorDraftRestoreResult,
  CalculatorDraftWriteResult,
} from './calculatorDraftPersistence';
import { useCalculatorDraftSession, type CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

type DraftSessionResult = ReturnType<typeof useCalculatorDraftSession>;

let latest: DraftSessionResult | null = null;

function makeInputs(projectName: string, moduleCount = 1) {
  const values = makeDefaultCalculatorInputs();
  return {
    ...values,
    projectName,
    modules: Array.from({ length: moduleCount }, (_, index) => makeDefaultModule(`pergola-${index + 1}`)),
    pergolas: Array.from({ length: moduleCount }, (_, index) => ({
      id: `pergola-${index + 1}`,
      label: `Pergola ${index + 1}`,
    })),
  };
}

function makeSnapshot(projectName: string, activeModuleIndex = 0, moduleCount = 1): CalculatorDraftSessionSnapshot {
  return {
    activeModuleIndex,
    updatedAt: 1,
    values: makeInputs(projectName, moduleCount),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makePersistence(overrides: Partial<CalculatorDraftPersistence> = {}): CalculatorDraftPersistence {
  return {
    restore: vi.fn().mockResolvedValue(null),
    persist: vi.fn().mockResolvedValue({ sessionStored: true, workingCopyStored: true }),
    ...overrides,
  };
}

function Probe({
  entityKey,
  sessionKey,
  awaitsExternalDraft,
  persistence,
}: {
  entityKey: string;
  sessionKey: string;
  awaitsExternalDraft: boolean;
  persistence: CalculatorDraftPersistence;
}) {
  latest = useCalculatorDraftSession({
    draftEntityKey: entityKey,
    draftSessionKey: sessionKey,
    awaitsExternalDraft,
    persistence,
  });
  return (
    <div
      data-status={latest.localDraftStatus.kind}
      data-hydrated={String(latest.draftHydrated)}
      data-project={latest.values.projectName}
      data-module-index={String(latest.activeModuleIndex)}
    />
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function status(): CalculatorLocalDraftStatus {
  if (!latest) throw new Error('Draft session probe has not rendered.');
  return latest.localDraftStatus;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
});

describe('useCalculatorDraftSession', () => {
  it('does not persist before hydration completes', async () => {
    const restoration = deferred<CalculatorDraftRestoreResult | null>();
    const write = deferred<CalculatorDraftWriteResult>();
    const persistence = makePersistence({
      restore: vi.fn(() => restoration.promise),
      persist: vi.fn(() => write.promise),
    });
    const rendered = renderIntoDocument(
      <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft={false} persistence={persistence} />,
    );

    expect(status()).toEqual({ kind: 'idle' });
    expect(persistence.persist).not.toHaveBeenCalled();

    restoration.resolve(null);
    await flushEffects();
    expect(status()).toEqual({ kind: 'saving' });
    expect(persistence.persist).toHaveBeenCalledTimes(1);

    write.resolve({ sessionStored: true, workingCopyStored: false });
    await flushEffects();
    expect(status()).toEqual({ kind: 'saved' });
    rendered.unmount();
  });

  it('restores normalized values and the active module without immediately rewriting them', async () => {
    const persistence = makePersistence({
      restore: vi.fn().mockResolvedValue({
        snapshot: makeSnapshot('Restored project', 1, 2),
        source: 'working-copy',
      }),
    });
    const rendered = renderIntoDocument(
      <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft persistence={persistence} />,
    );
    await flushEffects();

    expect(latest?.draftHydrated).toBe(true);
    expect(latest?.restoredFromLocalDraft).toBe(true);
    expect(latest?.values.projectName).toBe('Restored project');
    expect(latest?.activeModuleIndex).toBe(1);
    expect(status()).toEqual({ kind: 'restored', source: 'working-copy' });
    expect(persistence.persist).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('keeps the default fallback isolated while waiting for an external estimate draft', async () => {
    const persistence = makePersistence();
    const rendered = renderIntoDocument(
      <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft persistence={persistence} />,
    );
    await flushEffects();

    expect(latest?.draftHydrated).toBe(true);
    expect(latest?.values.projectName).toBe('');
    expect(status()).toEqual({ kind: 'idle' });
    expect(persistence.persist).not.toHaveBeenCalled();

    act(() => latest?.acceptExternalDraft(makeInputs('Server estimate')));
    await flushEffects();
    expect(latest?.values.projectName).toBe('Server estimate');
    expect(persistence.persist).toHaveBeenCalledTimes(1);
    expect(status()).toEqual({ kind: 'saved' });
    rendered.unmount();
  });

  it.each([
    [{ sessionStored: true, workingCopyStored: false }, 'saved'],
    [{ sessionStored: false, workingCopyStored: true }, 'saved'],
    [{ sessionStored: false, workingCopyStored: false }, 'error'],
  ] satisfies Array<[CalculatorDraftWriteResult, CalculatorLocalDraftStatus['kind']]>) (
    'maps persistence result %# to %s',
    async (writeResult, expectedStatus) => {
      const persistence = makePersistence({ persist: vi.fn().mockResolvedValue(writeResult) });
      const rendered = renderIntoDocument(
        <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft={false} persistence={persistence} />,
      );
      await flushEffects();
      expect(status().kind).toBe(expectedStatus);
      rendered.unmount();
    },
  );

  it('keeps the newest write status when an older write completes later', async () => {
    const firstWrite = deferred<CalculatorDraftWriteResult>();
    const secondWrite = deferred<CalculatorDraftWriteResult>();
    const persistence = makePersistence({
      persist: vi
        .fn()
        .mockImplementationOnce(() => firstWrite.promise)
        .mockImplementationOnce(() => secondWrite.promise),
    });
    const rendered = renderIntoDocument(
      <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft persistence={persistence} />,
    );
    await flushEffects();

    act(() => latest?.acceptExternalDraft(makeInputs('First external draft')));
    await flushEffects();
    expect(persistence.persist).toHaveBeenCalledTimes(1);

    act(() => latest?.setValues((current) => ({ ...current, projectName: 'Newest edit' })));
    await flushEffects();
    expect(persistence.persist).toHaveBeenCalledTimes(2);

    secondWrite.resolve({ sessionStored: true, workingCopyStored: false });
    await flushEffects();
    expect(status()).toEqual({ kind: 'saved' });

    firstWrite.resolve({ sessionStored: false, workingCopyStored: false });
    await flushEffects();
    expect(status()).toEqual({ kind: 'saved' });
    rendered.unmount();
  });

  it('does not persist the previous draft under a newly selected key', async () => {
    const persistence = makePersistence();
    const rendered = renderIntoDocument(
      <Probe entityKey="entity-a" sessionKey="session-a" awaitsExternalDraft persistence={persistence} />,
    );
    await flushEffects();
    act(() => latest?.acceptExternalDraft(makeInputs('Project A')));
    await flushEffects();
    expect(persistence.persist).toHaveBeenCalledTimes(1);

    rendered.rerender(
      <Probe entityKey="entity-b" sessionKey="session-b" awaitsExternalDraft persistence={persistence} />,
    );
    await flushEffects();
    expect(persistence.persist).toHaveBeenCalledTimes(1);
    expect(status()).toEqual({ kind: 'idle' });

    act(() => latest?.acceptExternalDraft(makeInputs('Project B')));
    await flushEffects();
    expect(persistence.persist).toHaveBeenCalledTimes(2);
    expect(persistence.persist).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityKey: 'entity-b',
        sessionKey: 'session-b',
        snapshot: expect.objectContaining({ values: expect.objectContaining({ projectName: 'Project B' }) }),
      }),
    );
    rendered.unmount();
  });
});
