import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import ReadStatus from './ReadStatus';
import { renderToString } from 'react-dom/server';

afterEach(() => { document.body.innerHTML = ''; });

it('keeps routine read labels separate from immediate mutation feedback and announces failures appropriately', () => {
  const view = renderIntoDocument(<div><ReadStatus title="Contact current" /><ReadStatus title="Contact details" /><p role="status">Save needs attention</p></div>);
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(1);
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe('Save needs attention');
  view.rerender(<ReadStatus title="Showing saved contact" tone="warning" />);
  expect(view.container.querySelector('[aria-live="polite"]')?.textContent).toBe('Showing saved contact');
  view.rerender(<ReadStatus title="Contact unavailable" tone="error" />);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Contact unavailable');
  view.unmount();
});

it('keeps one local status owner while error details open outside the work flow and Retry stays immediately available', () => {
  const retry = vi.fn();
  const view = renderIntoDocument(<ReadStatus title="Reading projects…" />);
  const status = view.container.firstElementChild;
  view.rerender(<ReadStatus title="Refresh failed" tone="error" action={<button onClick={retry}>Retry</button>}
    details={<p>The current read failed. Saved records remain available.</p>} />);
  expect(view.container.firstElementChild).toBe(status);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Refresh failed');
  const buttons = Array.from(view.container.querySelectorAll('button'));
  act(() => buttons.find(button => button.textContent === 'Retry')!.click());
  expect(retry).toHaveBeenCalledOnce();
  const details = buttons.find(button => button.textContent === 'Details')!;
  act(() => { details.focus(); details.click(); });
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('Saved records remain available');
  expect(view.container.contains(dialog)).toBe(false);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(details);
  view.rerender(<ReadStatus title="12 projects" />);
  expect(view.container.firstElementChild).toBe(status);
  expect(view.container.textContent).toBe('12 projects');
  view.unmount();
});

it('allows presentation on the existing root and an explicit details name without changing the default surface',()=>{
  const retry=vi.fn();
  const tree=<ReadStatus title="Saved project" tone="warning" className="project-compact" data-project-read-feedback triggerAriaLabel="Saved project details" onRetry={retry} details={<p>Latest read failed.</p>}/>;
  const markup=document.createElement('div');markup.innerHTML=renderToString(tree);
  expect(markup.children).toHaveLength(1);expect(markup.firstElementChild?.children).toHaveLength(2);
  expect(markup.querySelector('span > div')).toBeNull();
  const view=renderIntoDocument(tree),root=view.container.firstElementChild!;
  expect(root.classList.contains('project-compact')).toBe(true);expect(root.hasAttribute('data-project-read-feedback')).toBe(true);
  expect(root.querySelector('[aria-live="polite"]')?.textContent).toBe('Saved project');
  const details=root.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  expect(details.getAttribute('aria-label')).toBe('Saved project details');
  act(()=>{details.focus();details.click();});expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Latest read failed.');
  act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.activeElement).toBe(details);
  act(()=>[...root.querySelectorAll('button')].find(button=>button.textContent==='Retry')!.click());expect(retry).toHaveBeenCalledOnce();
  view.rerender(<ReadStatus title="Projects current" details={<p>Default details</p>}/>);
  expect(view.container.firstElementChild).toBe(root);expect(root.classList.contains('project-compact')).toBe(false);expect(root.hasAttribute('data-project-read-feedback')).toBe(false);
  expect(root.querySelector('button')?.textContent).toBe('Details');expect(root.querySelector('button')?.hasAttribute('aria-label')).toBe(false);
  expect(root.querySelector('[role="status"]')).toBeNull();view.unmount();
});
