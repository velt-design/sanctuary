import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CalculatorLoading from './loading';

it('renders the final Calculator frame while project and design values load', () => {
  const html = renderToStaticMarkup(<CalculatorLoading />);

  expect(html).toContain('data-portal-page-shell="calculator"');
  expect(html).toContain('data-portal-page-shell-ready="true"');
  expect(html).toContain('data-calculator-workspace="standalone"');
  expect(html).toContain('data-calculator-command-bar="true"');
  expect(html).toContain('data-calculator-configuration-form="true"');
  expect(html).toContain('data-calculator-result-inspector="true"');
  expect(html).not.toContain('data-portal-instant-shell="calculator"');
});
