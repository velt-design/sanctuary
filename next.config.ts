import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enforce ESLint during production builds so issues fail CI.
  eslint: { ignoreDuringBuilds: false },
  // Enforce TypeScript correctness during production builds.
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // 6 months HSTS; include subdomains; preload optional if you submit to hstspreload.org
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Core marketing pages
      { source: '/about-us', destination: '/about', permanent: true },
      { source: '/gallery', destination: '/projects', permanent: true },
      { source: '/testimonials', destination: '/projects', permanent: true },
      // Avoid self-redirect loops. Only include redirects when source !== destination.

      // Category landing
      { source: '/pergolas', destination: '/products?group=pergolas', permanent: true },
      { source: '/accessories', destination: '/products', permanent: true },
      { source: '/materials', destination: '/products', permanent: true },

      // Product details
      { source: '/pergolas/the-pitched-pergola', destination: '/products/pergolas/pitched', permanent: true },
      { source: '/pergolas/gable-pergola', destination: '/products/pergolas/gable', permanent: true },
      { source: '/pergolas/hip-pergola', destination: '/products/pergolas/hip', permanent: true },
      // Freestanding has no 1:1; route to pergolas group (adjust to a detail if preferred)
      { source: '/pergolas/freestanding-pergola', destination: '/products?group=pergolas', permanent: true },

      // Accessories mapping
      { source: '/accessories/down-lights', destination: '/products/lighting-heating/downlights', permanent: true },
      { source: '/accessories/roller-blinds', destination: '/products/screens-walls/drop-down-blinds', permanent: true },
    ];
  },
};

export default nextConfig;
