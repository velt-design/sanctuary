import type { MetadataRoute } from 'next';
import { sections } from '@/data/mega';
import { projects } from '@/data/projects';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.sanctuarypergolas.co.nz';
  const staticRoutes = ['/', '/products', '/projects', '/contact', '/privacy'];
  const productRoutes = sections.flatMap((section) => section.items.map((item) => item.href));
  const projectRoutes = projects.map((project) => `/projects/${project.slug}`);
  const urls = Array.from(new Set([...staticRoutes, ...productRoutes, ...projectRoutes]));
  const now = new Date();
  return urls.map((u) => ({ url: `${base}${u}`, lastModified: now }));
}
