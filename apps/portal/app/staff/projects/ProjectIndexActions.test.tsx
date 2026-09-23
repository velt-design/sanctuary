import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexActions from './ProjectIndexActions';
vi.mock('@/components/projects/ProjectDeliveryAction', () => ({ default: ({ renderTrigger }: { renderTrigger: (open: () => void) => React.ReactNode }) => renderTrigger(() => {}) }));
const props = { project: { id: 'proj_1', projectName: 'Deck', createdAt: '2026-09-01T00:00:00Z' }, host: 'test', client: 'Sample client', nameEditor: <button>Edit name</button>, phone: <button>Edit phone</button>, address: <button>Edit address</button>, stageBusy: false, archiveBusy: false, isAdmin: true, onOpen: vi.fn(), onCorrect: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn() };
it('keeps contact editing and actions accessible without opening the project row', async () => {
  const rowOpen = vi.fn();
  const rendered = renderIntoDocument(<div onClick={rowOpen}><ProjectIndexActions {...props} /></div>);
  act(() => rendered.container.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('[role="menu"]')?.textContent).toContain('Mark delivery completed');
  act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item=>item.textContent==='Contact & location')!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Edit phone');
  act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(rendered.container.querySelector('button[aria-haspopup="menu"]'));
  expect(rowOpen).not.toHaveBeenCalled();
  rendered.unmount();
});
it('preserves stage correction and hides administrator-only actions for staff', async () => {
  const rendered = renderIntoDocument(<ProjectIndexActions {...props} isAdmin={false} />);
  act(() => rendered.container.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('[role="menu"]')?.textContent).not.toContain('Delete');
  act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item=>item.textContent==='Correct stage')!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
  expect(props.onCorrect).toHaveBeenCalledOnce();
  rendered.unmount();
});
