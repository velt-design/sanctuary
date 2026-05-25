import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RightInspectorPanel from './RightInspectorPanel';

describe('RightInspectorPanel (PR-W3b)', () => {
  it('renders the empty placeholder state when no selection is provided', () => {
    const markup = renderToStaticMarkup(<RightInspectorPanel />);
    expect(markup).toContain('data-right-inspector="true"');
    expect(markup).toContain('data-right-inspector-state="empty"');
    expect(markup).toContain('No selection');
    expect(markup).toContain('Select an object from the left tree');
  });

  it('renders the selected-object header and trust pill when provided', () => {
    const markup = renderToStaticMarkup(
      <RightInspectorPanel selectionLabel="Pergola 1" trustStatusLabel="Geometry ready" />,
    );
    expect(markup).toContain('>Pergola 1<');
    expect(markup).toContain('>Geometry ready<');
    // Empty body still shows hint because no children passed.
    expect(markup).toContain('data-right-inspector-state="empty"');
  });

  it('renders provided children and marks the panel as populated', () => {
    const markup = renderToStaticMarkup(
      <RightInspectorPanel selectionLabel="Pergola 1">
        <div data-test-section="primary">Primary section</div>
      </RightInspectorPanel>,
    );
    expect(markup).toContain('data-right-inspector-state="populated"');
    expect(markup).toContain('data-test-section="primary"');
    expect(markup).not.toContain('Select an object from the left tree');
  });
});
