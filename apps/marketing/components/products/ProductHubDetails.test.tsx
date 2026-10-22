import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { products } from '../../data/products';
import { projects } from '../../data/projects';
import ProductHubDetails from './ProductHubDetails';

vi.mock('../marketing-foundation/Primitives', () => ({ Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe('complete pergola overview support journey', () => {
  const html = renderToStaticMarkup(<ProductHubDetails />);
  it('keeps every accessory and built-example destination valid and unambiguous', () => {
    for (const product of products.filter(product => product.categorySlug !== 'pergolas')) {
      expect(html.split(`href="${product.route}"`)).toHaveLength(2);
    }
    const projectLinks = [...html.matchAll(/href="\/projects\/([^"]+)"/g)].map(match => match[1]);
    expect(projectLinks).toHaveLength(3);
    for (const slug of projectLinks) expect(projects.some(project => project.slug === slug)).toBe(true);
    expect(projectLinks.filter(slug => slug === 'warkworth-outdoor-room')).toHaveLength(1);
  });
  it('uses six existing subject photographs and separates roof finishes from comparison price scope', () => {
    const photoPaths = [...html.matchAll(/alt="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(photoPaths).size).toBe(6);
    for (const name of ['project-dairy-flat-02.jpg', 'project-riverhead-gable-03.webp', 'project-warkworth-outdoor-room-04.jpg', 'blind-coastal-mesh.webp', 'project-milford-garden-retreat-05-privacy-screens.jpg', 'project-goodhome-04.jpg']) {
      expect(existsSync(path.join(process.cwd(), 'apps/marketing/public/images', name))).toBe(true);
      expect(html).toContain(encodeURIComponent(name));
    }
    expect(html).toContain('the estimates above are for acrylic roofing with open sides');
    expect(html).toContain('Acrylic and timber lining');
  });
  it('retains bespoke help and cost guidance without inventing an enquiry audience', () => {
    expect(html).toContain('enquiry_intent=bespoke');
    expect(html).toContain('source_path=%2Fproducts');
    expect(html).not.toContain('enquiry_type=residential');
    expect(html.split('href="/pergola-cost-auckland"')).toHaveLength(2);
  });
});
