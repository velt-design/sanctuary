import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { EnquiryExperienceEmail } from './EnquiryExperienceEmail';

it('confirms a request without implying a booked visit or free travel outside Auckland', () => {
  const html = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={{name:'Taylor'}} />);
  expect(html).toContain('A visit is not booked yet');
  expect(html).toContain('free site measure and evaluation in Auckland');
  expect(html).toContain('Outside Auckland');
  expect(html).toContain('confirm availability and any travel cost first');
  const help = renderToStaticMarkup(<EnquiryExperienceEmail experience="help" variables={{name:'Taylor'}} />);
  expect(help).not.toContain('Your site-measure request has been received');
  expect(help).toContain('If a site measure would help');
});

it('keeps a customer budget distinct from calculated pricing and omits it for configured enquiries', () => {
  const variables = { name: 'Taylor', projectPreferences: { preferredTiming: 'Spring', budgetPreference: 'provided', budgetHint: '$20,000 <script>' } };
  const help = renderToStaticMarkup(<EnquiryExperienceEmail experience="help" variables={variables} />);
  expect(help).toContain('Preferred timing');
  expect(help).toContain('Your budget (NZD, including GST)');
  expect(help).toContain('$20,000 &lt;script&gt;');
  expect(help).not.toContain('<script>');
  const configured = renderToStaticMarkup(<EnquiryExperienceEmail experience="configured" variables={variables} />);
  expect(configured).toContain('Spring');
  expect(configured).not.toContain('$20,000');
});
