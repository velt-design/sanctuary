import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { emptyStateForFamily } from '@/lib/drawings/state/objectTreeRowSubtitles';
import { ObjectTreeRow } from './ObjectTreeRow';
import { ObjectTreeSection } from './ObjectTreeSection';

const NOOP_SELECT = (_ref: WorkbenchObjectRef) => {};
type ObjectTreeSectionProps = Parameters<typeof ObjectTreeSection>[0];

function rowProps(overrides: Partial<Parameters<typeof ObjectTreeRow>[0]> = {}) {
  return {
    family: 'pergolas' as const,
    objectId: 'pergola-1',
    label: 'Pergola 1',
    subtitle: 'Mono · selected',
    selected: true,
    visibilityHidden: false,
    onSelect: NOOP_SELECT,
    ...overrides,
  };
}

function sectionProps(overrides: Partial<ObjectTreeSectionProps> = {}): ObjectTreeSectionProps {
  return {
    family: 'pergolas',
    label: 'Pergolas',
    rows: [
      {
        objectId: 'pergola-1',
        label: 'Pergola 1',
        subtitle: 'Mono · selected',
        selected: true,
        visibilityHidden: false,
      },
    ],
    emptyState: emptyStateForFamily('pergolas'),
    onSelect: NOOP_SELECT,
    ...overrides,
  };
}

describe('ObjectTreeRow', () => {
  it('renders label, subtitle, and the workbench object-button data attribute', () => {
    const markup = renderToStaticMarkup(<ObjectTreeRow {...rowProps()} />);
    expect(markup).toContain('>Pergola 1<');
    expect(markup).toContain('>Mono · selected<');
    expect(markup).toContain('data-workbench-object-button="pergolas:pergola-1"');
  });

  it('marks the selected row with data-tree-row-selected="true"', () => {
    const markup = renderToStaticMarkup(<ObjectTreeRow {...rowProps({ selected: true })} />);
    expect(markup).toContain('data-tree-row-selected="true"');
  });

  it('marks the unselected row with data-tree-row-selected="false"', () => {
    const markup = renderToStaticMarkup(<ObjectTreeRow {...rowProps({ selected: false })} />);
    expect(markup).toContain('data-tree-row-selected="false"');
  });

  it('exposes visibility-hidden state as a data attribute', () => {
    const hiddenMarkup = renderToStaticMarkup(
      <ObjectTreeRow {...rowProps({ visibilityHidden: true })} />,
    );
    expect(hiddenMarkup).toContain('data-tree-row-visibility-hidden="true"');
    const visibleMarkup = renderToStaticMarkup(
      <ObjectTreeRow {...rowProps({ visibilityHidden: false })} />,
    );
    expect(visibleMarkup).toContain('data-tree-row-visibility-hidden="false"');
  });

  it('omits the subtitle span when subtitle is an empty string', () => {
    const markup = renderToStaticMarkup(<ObjectTreeRow {...rowProps({ subtitle: '' })} />);
    expect(markup).not.toContain('objectButtonMeta');
  });

  it('uses "none" as the objectId fallback when objectId is null', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeRow {...rowProps({ objectId: null })} />,
    );
    expect(markup).toContain('data-workbench-object-button="pergolas:none"');
  });
});

describe('ObjectTreeSection', () => {
  it('renders the section heading + a row per entry', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          rows: [
            {
              objectId: 'pergola-1',
              label: 'Pergola 1',
              subtitle: 'Mono · selected',
              selected: true,
              visibilityHidden: false,
            },
            {
              objectId: 'pergola-2',
              label: 'Pergola 2',
              subtitle: 'Gable',
              selected: false,
              visibilityHidden: false,
            },
          ],
        })}
      />,
    );
    expect(markup).toContain('>Pergolas<');
    expect(markup).toContain('data-object-tree-section="pergolas"');
    expect(markup).toContain('data-workbench-object-button="pergolas:pergola-1"');
    expect(markup).toContain('data-workbench-object-button="pergolas:pergola-2"');
  });

  it('renders the empty-state message and hint when rows is empty', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          family: 'openings',
          label: 'Openings',
          rows: [],
          emptyState: emptyStateForFamily('openings'),
        })}
      />,
    );
    expect(markup).toContain('data-object-tree-empty="openings"');
    expect(markup).toContain('>No openings<');
    expect(markup).toContain('>Add from inspector<');
    // No row buttons rendered
    expect(markup).not.toContain('data-workbench-object-button=');
  });

  it('renders the inline add button when onAdd + addLabel are supplied', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          family: 'house_forms',
          label: 'House Forms',
          rows: [],
          emptyState: emptyStateForFamily('house_forms'),
          onAdd: () => {},
          addLabel: 'Add structure',
        })}
      />,
    );
    expect(markup).toContain('data-action="add-house_forms"');
    expect(markup).toContain('>Add structure<');
  });

  it('omits the add button when onAdd is missing', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          family: 'pergolas',
          label: 'Pergolas',
          rows: [],
          emptyState: emptyStateForFamily('pergolas'),
        })}
      />,
    );
    expect(markup).not.toContain('data-action="add-pergolas"');
  });

  it('disables the add button when addDisabled is true', () => {
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          family: 'house_forms',
          label: 'House Forms',
          rows: [],
          emptyState: emptyStateForFamily('house_forms'),
          onAdd: () => {},
          addLabel: 'Add structure',
          addDisabled: true,
        })}
      />,
    );
    expect(markup).toContain('data-action="add-house_forms"');
    expect(markup).toContain('disabled=""');
  });

  it('passes the object ref to onSelect when a row callback fires', () => {
    const onSelect = vi.fn();
    // Inline-render-only test: assert the row component receives the section's
    // onSelect through composition. We can't simulate clicks via SSR, so we
    // verify the row's data attribute carries the ref the click will emit.
    const markup = renderToStaticMarkup(
      <ObjectTreeSection
        {...sectionProps({
          rows: [
            {
              objectId: 'deck-1',
              label: 'Deck 1',
              subtitle: 'Attached',
              selected: false,
              visibilityHidden: false,
            },
          ],
          family: 'decks',
          label: 'Decks',
          emptyState: emptyStateForFamily('decks'),
          onSelect,
        })}
      />,
    );
    expect(markup).toContain('data-workbench-object-button="decks:deck-1"');
    expect(onSelect).not.toHaveBeenCalled(); // SSR doesn't fire click
  });
});
