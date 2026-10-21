import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ArrowIcon from './ArrowIcon';
import ArrowUpRight from './ArrowUpRight';

describe('decorative marketing arrows', () => {
  it.each(['up-right', 'down-right', 'right', 'left', 'down', 'up', 'horizontal'] as const)('renders %s as geometry without changing the control label', direction => {
    const markup = renderToStaticMarkup(<button aria-label="Next project"><ArrowIcon direction={direction} /></button>);
    const container = document.createElement('div'); container.innerHTML = markup;
    const icon = container.querySelector('svg')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.getAttribute('focusable')).toBe('false');
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon.querySelector('path')?.getAttribute('d')).toBeTruthy();
    expect(icon.querySelector('text')).toBeNull();
    expect(icon.textContent).toBe('');
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Next project');
  });

  it('keeps the established diagonal path, sizing and explicit caller styling', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<ArrowUpRight className="existing-icon" style={{ width: 18, color: 'red' }} />);
    const icon = container.querySelector('svg')!;
    expect(icon.querySelector('path')?.getAttribute('d')).toBe('M5 19 19 5M5 5h14v14');
    expect(icon.getAttribute('width')).toBe('1em');
    expect(icon.getAttribute('height')).toBe('1em');
    expect(icon.getAttribute('stroke-width')).toBe('1.5');
    expect(icon.style.width).toBe('18px');
    expect(icon.style.color).toBe('red');
    expect(icon.getAttribute('class')).toBe('existing-icon');
  });
});
