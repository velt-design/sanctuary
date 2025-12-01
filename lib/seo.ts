export const siteUrl = 'https://www.sanctuarypergolas.co.nz';

export function absoluteUrl(path: string): string {
  try {
    if (!path) return siteUrl;
    if (/^https?:\/\//i.test(path)) return path;
    const p = path.startsWith('/') ? path : `/${path}`;
    return new URL(p, siteUrl).toString();
  } catch {
    return siteUrl;
  }
}

export function stripArrow(title: string): string {
  return (title || '').replace(/\s*→\s*$/, '');
}

export function metaDesc(input: string, max = 180): string {
  const s = (input || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!\-\s]+$/,'') + '…';
}

export function imageForSlug(slug: string): string {
  switch (slug) {
    case 'pitched':
      return '/images/product-pitched-01.jpg';
    case 'gable':
      return '/images/product-gable-01.jpg';
    case 'hip':
      return '/images/product-hip-01.jpg';
    case 'box-perimeter':
      return '/images/product-perimeter-01.jpg';
    case 'slat-screens':
      return '/images/project-st-heliers-01.jpg';
    case 'acrylic-infill-panels':
      return '/images/project-st-heliers-02.jpg';
    case 'drop-down-blinds':
      return '/images/project-goodhome-02.jpg';
    case 'downlights':
      return '/images/hero-1.jpg';
    case 'led-strip-lighting':
      return '/images/project-kiwi-rail-02.jpg';
    case 'patio-heaters':
      return '/images/project-goodhome-01.jpg';
    default:
      return '/assets/hero-right.jpg';
  }
}

