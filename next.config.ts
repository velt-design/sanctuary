import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enforce TypeScript correctness during production builds.
  typescript: { ignoreBuildErrors: false },
  async headers() {
    const securityHeaders: { key: string; value: string }[] = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      // 6 months HSTS; include subdomains; preload optional if you submit to hstspreload.org
      { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
    ];

    if (process.env.NODE_ENV === 'production') {
      const csp = [
        "default-src 'self'",
        // Allow inline scripts so Next.js runtime and analytics can execute.
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://connect.facebook.net https://pixel.archipro.co.nz https://static.cloudflareinsights.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://www.google-analytics.com https://www.sanctuarypergolas.co.nz https://www.facebook.com https://stats.g.doubleclick.net https://www.googleadservices.com",
        "font-src 'self' data:",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googleadservices.com https://www.facebook.com https://graph.facebook.com https://pixel.archipro.co.nz",
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ');
      securityHeaders.push({ key: 'Content-Security-Policy', value: csp });
    }

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
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
