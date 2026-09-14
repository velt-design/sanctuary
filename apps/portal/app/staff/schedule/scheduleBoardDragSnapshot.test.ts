import { describe, expect, it, vi } from 'vitest';
import { captureBoardDragSnapshot } from './scheduleBoardDragSnapshot';

describe('Board floating card snapshot', () => {
  it('preserves the visual card without duplicating interactive identity or events', () => {
    const card = document.createElement('div');
    card.innerHTML = '<button id="open-job" aria-describedby="help">Pergola</button><span>10–12 Sep · 3d</span>';
    card.dataset.scheduleCardId = 'job';
    card.dataset.dragging = 'true';
    card.dataset.dropTarget = 'true';
    card.style.opacity = '0.35';
    const clicked = vi.fn();
    card.querySelector('button')!.addEventListener('click', clicked);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: 296, height: 148 } as DOMRect);
    const snapshot = captureBoardDragSnapshot('job', card);
    expect(snapshot.width).toBe(296);
    expect(snapshot.height).toBe(148);
    expect(snapshot.node.textContent).toBe(card.textContent);
    expect(snapshot.node.querySelector('[id], [aria-describedby], [data-schedule-card-id]')).toBeNull();
    expect(snapshot.node.hasAttribute('data-dragging')).toBe(false);
    expect(snapshot.node.inert).toBe(true);
    expect(snapshot.node.style.opacity).toBe('1');
    snapshot.node.querySelector('button')!.click();
    expect(clicked).not.toHaveBeenCalled();
    expect(card.dataset.dragging).toBe('true');
  });
});
