import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, Input, Radio, Select, Switch, Textarea } from './FoundationControls';
import { renderIntoDocument } from '../../../../../test/reactHarness';

describe('UI foundation controls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('preserves native control semantics and visible labels', () => {
    const rendered = renderIntoDocument(
      <div>
        <Input label="Project name" error="Project name is required" />
        <Textarea label="Notes" helperText="Staff only" />
        <Select label="Stage" defaultValue="new"><option value="new">New</option></Select>
        <Checkbox label="Include archived" defaultChecked />
        <Radio label="Option one" name="choice" />
        <Switch label="Notifications" defaultChecked />
        <Input label="Reference" readOnly value="Q-2307" />
      </div>,
    );

    const input = rendered.container.querySelector('input[aria-invalid="true"]') as HTMLInputElement;
    expect(input.labels?.[0]?.textContent).toBe('Project name');
    expect(rendered.container.textContent).toContain('Project name is required');
    expect(rendered.container.querySelector('textarea')?.labels?.[0]?.textContent).toBe('Notes');
    expect(rendered.container.querySelector('select')?.labels?.[0]?.textContent).toBe('Stage');
    expect((rendered.container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true);
    expect(rendered.container.querySelector('input[role="switch"]')).not.toBeNull();
    expect(rendered.container.querySelector('input[type="radio"]')).not.toBeNull();
    expect((rendered.container.querySelector('input[readonly]') as HTMLInputElement).value).toBe('Q-2307');

    rendered.unmount();
  });

  it('disables loading buttons and keeps callback buttons operable', () => {
    const onClick = vi.fn();
    const rendered = renderIntoDocument(
      <div>
        <Button loading>Save</Button>
        <Button onClick={onClick}>Create quote</Button>
      </div>,
    );
    const buttons = rendered.container.querySelectorAll('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].getAttribute('aria-busy')).toBe('true');

    act(() => buttons[1].click());
    expect(onClick).toHaveBeenCalledTimes(1);

    rendered.unmount();
  });
});
