import type { MetadataRoute } from 'next';
import { products } from '@/data/products';
import { projects } from '@/data/projects';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.sanctuarypergolas.co.nz';
  const staticRoutes = ['/', '/pergola-guides', '/pergolas-auckland', '/custom-pergolas-auckland', '/aluminium-pergolas-auckland', '/pergola-cost-auckland', '/gable-pergolas-auckland', '/pitched-pergolas-auckland', '/outdoor-rooms-auckland', '/pergolas-with-blinds', '/acrylic-pergolas-vs-louvre-roofs', '/commercial-pergolas-auckland', '/architects-designers-builders', '/acrylic-roof-pergolas-auckland', '/products', '/projects', '/contact', '/privacy'];
  const productRoutes = products.map((product) => product.route);
  const projectRoutes = projects.map((project) => `/projects/${project.slug}`);
  const urls = Array.from(new Set([...staticRoutes, ...productRoutes, ...projectRoutes]));
  return urls.map((u) => ({ url: `${base}${u}` }));
}
