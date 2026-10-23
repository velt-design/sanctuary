import { afterEach, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('./FinanceRegisterFixture', () => ({ default: () => <div>Synthetic normal-shell preview</div> }));
afterEach(() => vi.unstubAllEnvs());

it.each([['production','1'],['development','0'],['test','1']])('denies the shell fixture in %s with flag %s', (environment, flag) => {
  vi.stubEnv('NODE_ENV', environment); vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', flag);
  expect(() => Page()).toThrow('NOT_FOUND');
});
it('admits only the explicitly enabled development fixture', () => {
  vi.stubEnv('NODE_ENV','development'); vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');
  expect(Page().type).toBeTypeOf('function');
});
