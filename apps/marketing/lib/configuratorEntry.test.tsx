import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildConfiguratorEnquiryHref, buildHomeConfiguratorHref } from './configuratorEntry';
import { buildEnquiryHref, type EnquiryContext } from './enquiryContext';
import ContactPathwaySelector from '../app/contact/ContactPathwaySelector';

describe('designer entry context', () => {
  it('opens the full designer from the homepage with its selected priorities', () => {
    const href = new URL(buildHomeConfiguratorHref(['daylight', 'shade']), 'https://example.com');
    expect(href.pathname).toBe('/contact');
    expect(href.searchParams.get('configurator')).toBe('preview');
    expect(href.searchParams.get('source_path')).toBe('/');
    expect(href.searchParams.get('source_component')).toBe('project_finder');
    expect(href.searchParams.get('project_direction')).toBe('cover');
    expect(href.searchParams.get('project_priorities')).toBe('daylight,shade');
  });
  const context: EnquiryContext = {enquiryType:'professional', sourcePath:'/projects/warkworth-outdoor-room',
    sourceProject:'warkworth-outdoor-room', sourceComponent:'project_cta'};
  it('retains governed project and audience context without jumping past the design', () => {
    const href = new URL(buildConfiguratorEnquiryHref(context), 'https://example.com');
    const original = new URL(buildEnquiryHref(context), 'https://example.com');
    for (const [key,value] of original.searchParams) expect(href.searchParams.get(key)).toBe(value);
    expect(href.searchParams.get('source_project')).toBe('warkworth-outdoor-room');
    expect(href.searchParams.get('enquiry_type')).toBe('professional');
    expect(href.searchParams.get('configurator')).toBe('preview');
    expect(href.hash).toBe('');
  });
  it('uses the same context-preserving destination in the pathway selector', () => {
    const html = renderToStaticMarkup(<ContactPathwaySelector isEnhanced pathway={null} hasError={false}
      errorId="error" initialAudience="professional" sourceContext={context} onChange={() => {}} />);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('#contact-pathway-simple')?.getAttribute('href'))
      .toBe(buildConfiguratorEnquiryHref(context));
  });
  it('never copies ungoverned query parameters or external source URLs', () => {
    const href = buildConfiguratorEnquiryHref({sourcePath:'https://example.com/private',
      email:'private@example.com', calculationRef:'untrusted'} as EnquiryContext);
    expect(href).toBe('/contact?configurator=preview');
  });
});
