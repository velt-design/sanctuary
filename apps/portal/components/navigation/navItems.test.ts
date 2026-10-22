import { expect, it } from 'vitest';
import { isNavParentActive } from './navRouteMatch';
import { NAV_ITEMS, visibleNavItems } from './navItems';
it('limits the marketing navigation hint to Jordan without changing finance or admin policy', () => {
  const keys=(role:string,email?:string)=>visibleNavItems(role,false,email).map(item=>item.key);
  expect(keys('staff','Jordan@sanctuarypergolas.co.nz')).toContain('marketing-performance');
  for(const email of [undefined,'other@example.test','jordan@sanctuarypergolas.co.nz.evil']) {
    expect(keys('admin',email)).not.toContain('marketing-performance');
  }
  expect(keys('staff','jordan@sanctuarypergolas.co.nz')).not.toContain('access');
  expect(keys('admin','jordan@sanctuarypergolas.co.nz')).not.toContain('finance');
});

it('targets the six canonical navigation leaves and retains Schedule view and parent context', () => {
  const links = NAV_ITEMS.flatMap(item => [item, ...('children' in item ? item.children : [])]);
  for (const href of ['/dashboard', '/staff/projects', '/staff/contacts', '/staff/schedule', '/staff/projects/design-packages', '/staff/projects/running-jobs']) {
    expect(links.some(item => item.href === href)).toBe(true);
  }
  const schedule = NAV_ITEMS.find(item => item.key === 'schedule')!;
  expect(schedule.href).toBe('/staff/schedule');
  expect(schedule.children.map(item => item.href)).toEqual(['/staff/schedule?view=board', '/staff/schedule?view=gantt', '/staff/site-visits']);
  for (const path of ['/staff/schedule', '/schedule', '/staff/site-visits']) expect(isNavParentActive(path, schedule.href)).toBe(true);
});
