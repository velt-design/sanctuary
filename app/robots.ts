import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: [
      'https://www.sanctuarypergolas.co.nz/sitemap.xml',
      'https://www.sanctuarypergolas.co.nz/sitemap-images.xml',
    ],
  };
}
