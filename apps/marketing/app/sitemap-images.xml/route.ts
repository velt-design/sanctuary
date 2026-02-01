import { projects } from '@/data/projects';
import { absoluteUrl } from '@/lib/seo';

export const runtime = 'nodejs';

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const entries = projects.map((project) => {
    const imageSet = new Set<string>();
    if (project.heroImage?.src) imageSet.add(project.heroImage.src);
    project.gallery?.forEach((image) => {
      if (image?.src) imageSet.add(image.src);
    });
    const images = Array.from(imageSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return {
      url: absoluteUrl(`/projects/${project.slug}`),
      images,
    };
  }).filter((entry) => entry.images.length > 0);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.flatMap((entry) => {
      const lines = [`  <url>`, `    <loc>${escapeXml(entry.url)}</loc>`];
      entry.images.forEach((src) => {
        lines.push(`    <image:image>`);
        lines.push(`      <image:loc>${escapeXml(absoluteUrl(src))}</image:loc>`);
        lines.push('    </image:image>');
      });
      lines.push('  </url>');
      return lines;
    }),
    '</urlset>',
  ].join('\n');

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
