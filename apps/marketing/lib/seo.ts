const siteUrl = 'https://www.sanctuarypergolas.co.nz';

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

