import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SimplePergolaJourney from './SimplePergolaJourney';

it('offers one designer and distinct assisted routes without a duplicate enquiry form', () => {
  const html = renderToStaticMarkup(<SimplePergolaJourney sourceContext={{enquiryType:'residential',sourcePath:'/simple-pergolas-auckland',sourceComponent:'embedded_form'}}>
    <p>Product information</p>
  </SimplePergolaJourney>);
  const doc = new DOMParser().parseFromString(html,'text/html');
  const links = [...doc.querySelectorAll('a')];
  const design = links.filter(link => link.textContent?.includes('Design your pergola'));
  expect(design).toHaveLength(2);
  for (const link of design) {
    const url = new URL(link.getAttribute('href')!, 'https://example.com');
    expect(url.searchParams.get('configurator')).toBe('preview');
    expect(url.searchParams.get('source_path')).toBe('/simple-pergolas-auckland');
  }
  expect(links.find(link=>link.textContent?.includes('help'))?.getAttribute('href')).toContain('enquiry_intent=help');
  expect(links.find(link=>link.textContent?.includes('bespoke'))?.getAttribute('href')).toContain('enquiry_intent=bespoke');
  expect(doc.querySelector('form')).toBeNull();
  expect(doc.querySelector('#initial-estimate')).not.toBeNull();
  expect(doc.body.textContent).toContain('does not book an appointment');
  expect(doc.body.textContent).toContain('Product information');
});
