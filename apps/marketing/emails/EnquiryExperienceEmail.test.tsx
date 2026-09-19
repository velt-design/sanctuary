import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { EnquiryExperienceEmail } from './EnquiryExperienceEmail';

it('shows the frozen total and every extra, and refuses an inconsistent breakdown', () => {
  const configuredEstimate = { amountIncGst: 13500, currency: 'NZD', includesGst: true,
    breakdown: [{ label: 'Pergola, roof & ceiling', amountIncGst: 12000 }, { label: 'Lighting', amountIncGst: 1500 }] };
  const html = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={{ configuredEstimate }} />);
  expect(html).toContain('$13,500'); expect(html).toContain('$12,000'); expect(html).toContain('Lighting'); expect(html).toContain('$1,500');
  expect(html).toContain('including GST'); expect(html).not.toContain('Early installed estimate');
  const invalid = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={{ configuredEstimate: { ...configuredEstimate, amountIncGst: 14000 } }} />);
  expect(invalid).not.toContain('$14,000'); expect(invalid).toContain('tailored quote');
});

it('confirms a request without implying a booked visit or free travel outside Auckland', () => {
  const html = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={{name:'Taylor'}} />);
  expect(html).toContain('A visit is not booked yet');
  expect(html).toContain('free site measure and evaluation in Auckland');
  expect(html).toContain('Outside Auckland');
  expect(html).toContain('confirm availability and any travel cost first');
  const help = renderToStaticMarkup(<EnquiryExperienceEmail experience="help" variables={{name:'Taylor'}} />);
  expect(help).not.toContain('Your site-measure request has been received');
  expect(help).toContain('help you choose a pergola');
});

it('keeps supplied preferences in the submission without repeating them in the receipt', () => {
  const variables = { name: 'Taylor', projectPreferences: { preferredTiming: 'Spring', budgetPreference: 'provided', budgetHint: '$20,000 <script>' } };
  const help = renderToStaticMarkup(<EnquiryExperienceEmail experience="help" variables={variables} />);
  expect(help).not.toContain('Preferred timing');
  expect(help).not.toContain('$20,000');
  expect(help).not.toContain('<script>');
  const configured = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={variables} />);
  expect(configured).not.toContain('Spring');
  expect(configured).not.toContain('$20,000');
  expect(variables.projectPreferences.budgetHint).toBe('$20,000 <script>');
});
