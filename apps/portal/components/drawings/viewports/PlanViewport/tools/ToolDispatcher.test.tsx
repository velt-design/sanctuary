import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { ToolDispatcherProvider, useToolDispatcher } from './ToolDispatcher';
import type { Tool, ToolPointerEvent } from './Tool';

function makeTool(id: string, hooks: {
  onPointerDown?: (event: ToolPointerEvent) => void;
  onCancel?: () => void;
} = {}): Tool {
  return {
    id,
    onPointerDown: hooks.onPointerDown,
    onCancel: hooks.onCancel,
  };
}

function basicEvent(): ToolPointerEvent {
  return {
    shape: null,
    point: { x: 0, y: 0 },
    button: 0,
    pointerId: 1,
  };
}

type ConsumerProps = {
  next?: Tool;
  switchOnMount?: boolean;
  trigger?: (api: ReturnType<typeof useToolDispatcher>) => void;
};

function Consumer({ next, switchOnMount, trigger }: ConsumerProps) {
  const api = useToolDispatcher();
  useEffect(() => {
    if (switchOnMount && next) api.setActiveTool(next);
    if (trigger) trigger(api);
  }, [api, next, switchOnMount, trigger]);
  return <div data-active-tool-id={api.activeTool.id}>active</div>;
}

describe('ToolDispatcherProvider', () => {
  it('exposes the initial tool as the active tool', () => {
    const tool = makeTool('select');
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={tool}>
        <Consumer />
      </ToolDispatcherProvider>,
    );
    expect(rendered.container.querySelector('[data-active-tool-id]')?.getAttribute('data-active-tool-id')).toBe('select');
    rendered.unmount();
  });

  it('routes pointer events to the active tool', () => {
    const onPointerDown = vi.fn();
    const tool = makeTool('select', { onPointerDown });
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={tool}>
        <Consumer trigger={(api) => api.dispatchPointerDown(basicEvent())} />
      </ToolDispatcherProvider>,
    );
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('cancels the previous tool when switching to a different tool', () => {
    const onCancel = vi.fn();
    const select = makeTool('select', { onCancel });
    const move = makeTool('move');
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={select}>
        <Consumer next={move} switchOnMount />
      </ToolDispatcherProvider>,
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(rendered.container.querySelector('[data-active-tool-id]')?.getAttribute('data-active-tool-id')).toBe('move');
    rendered.unmount();
  });

  it('does not cancel when setActiveTool is called with the same tool id', () => {
    const onCancel = vi.fn();
    const a = makeTool('select', { onCancel });
    const b = makeTool('select', { onCancel });
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={a}>
        <Consumer next={b} switchOnMount />
      </ToolDispatcherProvider>,
    );
    expect(onCancel).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('swaps to a new initialTool when the prop changes to a tool with a different id', () => {
    const onCancelSelect = vi.fn();
    const select = makeTool('select', { onCancel: onCancelSelect });
    const edgeDrag = makeTool('edge-drag');
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={select}>
        <Consumer />
      </ToolDispatcherProvider>,
    );
    expect(rendered.container.querySelector('[data-active-tool-id]')?.getAttribute('data-active-tool-id')).toBe('select');
    rendered.rerender(
      <ToolDispatcherProvider initialTool={edgeDrag}>
        <Consumer />
      </ToolDispatcherProvider>,
    );
    expect(rendered.container.querySelector('[data-active-tool-id]')?.getAttribute('data-active-tool-id')).toBe('edge-drag');
    expect(onCancelSelect).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });

  it('cancels the active tool on unmount', () => {
    const onCancel = vi.fn();
    const tool = makeTool('select', { onCancel });
    const rendered = renderIntoDocument(
      <ToolDispatcherProvider initialTool={tool}>
        <Consumer />
      </ToolDispatcherProvider>,
    );
    rendered.unmount();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
