import { expect, it } from 'vitest';
import { visibleNavItems } from './navItems';
it('limits the marketing navigation hint to Jordan without changing finance or admin policy', () => {
  const keys=(role:string,email?:string)=>visibleNavItems(role,false,email).map(item=>item.key);
  expect(keys('staff','Jordan@sanctuarypergolas.co.nz')).toContain('marketing-performance');
  for(const email of [undefined,'other@example.test','jordan@sanctuarypergolas.co.nz.evil']) {
    expect(keys('admin',email)).not.toContain('marketing-performance');
  }
  expect(keys('staff','jordan@sanctuarypergolas.co.nz')).not.toContain('access');
  expect(keys('admin','jordan@sanctuarypergolas.co.nz')).not.toContain('finance');
});
