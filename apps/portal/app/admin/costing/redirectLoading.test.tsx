import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MaterialsLoading from '../costs/materials/loading';
import ActionsLoading from '../costs/actions/loading';
import OverheadsLoading from '../costs/overheads/loading';
import PricebookLoading from '../../pricebook/loading';

describe('Legacy pricebook route loading frames', () => {
  it.each([
    ['materials', MaterialsLoading],
    ['actions', ActionsLoading],
    ['overheads', OverheadsLoading],
    ['pricebook', PricebookLoading],
  ])('shows the canonical Costing control frame for %s', (_name, Loading) => {
    const markup = renderToStaticMarkup(<Loading />);

    expect(markup).toContain('data-portal-page-shell="admin-costing"');
    expect(markup).toContain('data-portal-page-shell-ready="true"');
    expect(markup).toContain('Costing control centre');
  });
});
