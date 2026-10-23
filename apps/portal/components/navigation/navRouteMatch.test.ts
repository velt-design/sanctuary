import { expect, it } from 'vitest';
import { isNavParentActive } from './navRouteMatch';

it('highlights only the exact local Finance fixture as Finance navigation', () => {
  expect(isNavParentActive('/qa/finance-register', '/staff/payments')).toBe(true);
  expect(isNavParentActive('/qa/finance-register-other', '/staff/payments')).toBe(false);
  expect(isNavParentActive('/qa/finance-register', '/staff/projects')).toBe(false);
  expect(isNavParentActive('/staff/payments', '/staff/payments')).toBe(true);
  expect(isNavParentActive('/staff/site-visits', '/schedule')).toBe(true);
});
