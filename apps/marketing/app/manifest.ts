import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sanctuary Pergolas',
    short_name: 'Sanctuary',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111111',
    icons: [
      { src: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { src: '/logo-sanctuary.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
