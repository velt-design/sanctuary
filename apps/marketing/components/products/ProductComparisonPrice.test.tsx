import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ProductComparisonPrice from './ProductComparisonPrice';
import { INITIAL_PRODUCT_SELECTION, productSelectionDraft } from './productSelection';
import { solvePergolaPreview } from '../configurator-prototype/solvePreview';

describe('overview public table presentation', () => {
  it('renders the exact selected pair without a pricing hook', () => {
    const html=renderToStaticMarkup(<ProductComparisonPrice type="pitched" selection={{...INITIAL_PRODUCT_SELECTION,projectionMm:5000}} table={{status:'priced',versionNumber:15,amounts:{'6000-5000':{pitched:14551,gable:20000,'box-perimeter':21000}}}}/>);
    expect(html).toContain('6 \u00d7 5 m'); expect(html).toContain('$14,600'); expect(html).toContain('Approximately '); expect(html).toContain('Including installation');
  });
  it.each(['loading','unavailable','disabled'] as const)('keeps %s truthful without a draft or old amount', status => {
    const html=renderToStaticMarkup(<ProductComparisonPrice type="pitched" table={{status}}/>);
    expect(html).toContain(status==='loading'?'Updating estimate':'Estimate unavailable'); expect(html).not.toContain('data-priced'); expect(html).not.toContain('Draft');
  });
});

describe('overview supported comparison geometry', () => {
  for (const type of ['pitched', 'gable', 'box-perimeter'] as const) {
    for (const [widthMm, projectionMm] of [[2000,3000],[4000,3000],[6000,3000],[8000,3000],[6000,4000],[6000,5000]]) {
      it(`${type} ${widthMm} x ${projectionMm} uses supported canonical geometry`, () => {
        const { draft, issue } = productSelectionDraft({ ...INITIAL_PRODUCT_SELECTION, widthMm, projectionMm }, type);
        expect(issue).toBeNull();
        expect(solvePergolaPreview(draft.input, draft.roof).geometry).toBeDefined();
      });
    }
  }
});
