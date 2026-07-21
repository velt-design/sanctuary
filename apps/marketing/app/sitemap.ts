import type { MetadataRoute } from 'next';
import { sections } from '@/data/mega';
import { projects } from '@/data/projects';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.sanctuarypergolas.co.nz';
  const staticRoutes = ['/', '/pergola-guides', '/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/commercial-pergolas-auckland', '/acrylic-roof-pergolas-auckland', '/products', '/projects', '/contact', '/privacy'];
  const productRoutes = sections.flatMap((section) => section.items.map((item) => item.href));
  const projectRoutes = projects.map((project) => `/projects/${project.slug}`);
  const urls = Array.from(new Set([...staticRoutes, ...productRoutes, ...projectRoutes]));
  return urls.map((u) => ({ url: `${base}${u}` }));
}
