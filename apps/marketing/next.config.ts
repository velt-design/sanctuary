import path from 'node:path';
import type { NextConfig } from 'next';

const marketingPlaywrightDistDir = process.env.MARKETING_PLAYWRIGHT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  ...(marketingPlaywrightDistDir ? { distDir: marketingPlaywrightDistDir } : {}),
  experimental: { externalDir: true },
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@sp/costing', '@sp/email-provider', '@sp/quote-format', '@sp/theme'],
  // Enforce TypeScript correctness during production builds.
  typescript: { ignoreBuildErrors: false },
  // Allow monorepo package resolution for workspace packages.
  turbopack: { root: path.resolve(__dirname, '../..') },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [45, 50, 55, 60, 65, 72, 75],
  },
  async headers() {
    const securityHeaders: { key: string; value: string }[] = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      // 1 year HSTS for preload readiness.
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    ];

    if (process.env.NODE_ENV === 'production') {
      const csp = [
        "default-src 'self'",
        // Allow inline scripts so Next.js runtime and analytics can execute.
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://pixel.archipro.co.nz https://static.cloudflareinsights.com https://googleads.g.doubleclick.net https://www.google.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://www.google-analytics.com https://www.sanctuarypergolas.co.nz https://www.facebook.com https://stats.g.doubleclick.net https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
        "font-src 'self' data:",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googleadservices.com https://www.facebook.com https://graph.facebook.com https://pixel.archipro.co.nz https://*.supabase.co wss://*.supabase.co https://www.google.com",
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.googletagmanager.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ');
      securityHeaders.push({ key: 'Content-Security-Policy', value: csp });

      const cspReportOnly = [
        "default-src 'self'",
        "script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://pixel.archipro.co.nz https://static.cloudflareinsights.com https://googleads.g.doubleclick.net https://www.google.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://www.google-analytics.com https://www.sanctuarypergolas.co.nz https://www.facebook.com https://stats.g.doubleclick.net https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
        "font-src 'self' data:",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googleadservices.com https://www.facebook.com https://graph.facebook.com https://pixel.archipro.co.nz https://*.supabase.co wss://*.supabase.co https://www.google.com",
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.googletagmanager.com",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "trusted-types default nextjs",
        "require-trusted-types-for 'script'",
        'report-to sp-csp-endpoint',
        'report-uri /api/security/csp-report',
      ].join('; ');
      securityHeaders.push({ key: 'Content-Security-Policy-Report-Only', value: cspReportOnly });
      securityHeaders.push({
        key: 'Report-To',
        value: '{"group":"sp-csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://www.sanctuarypergolas.co.nz/api/security/csp-report"}]}',
      });
    }

    const mediaCacheHeaders: { key: string; value: string }[] = [
      { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
    ];

    const runtimeScriptCacheHeaders: { key: string; value: string }[] = [
      { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' },
    ];

    return [
      {
        source: '/downloads/Sanctuary-Pergolas-Brochure.pdf',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/careers/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/images/:path*',
        headers: [...securityHeaders, ...mediaCacheHeaders],
      },
      {
        source: '/videos/:path*',
        headers: [...securityHeaders, ...mediaCacheHeaders],
      },
      {
        source: '/runtime-ga.js',
        headers: [...securityHeaders, ...runtimeScriptCacheHeaders],
      },
      {
        source: '/runtime-meta.js',
        headers: [...securityHeaders, ...runtimeScriptCacheHeaders],
      },
      {
        source: '/runtime-archipro.js',
        headers: [...securityHeaders, ...runtimeScriptCacheHeaders],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Core marketing pages
      { source: '/home-v2', destination: '/', permanent: true },
      { source: '/about-us', destination: '/', permanent: true },
      { source: '/gallery', destination: '/projects', permanent: true },
      { source: '/testimonials', destination: '/projects', permanent: true },
      // Avoid self-redirect loops. Only include redirects when source !== destination.

      // Renamed project slugs -> accurate slugs (keep inbound links / SEO equity)
      { source: '/projects/devonport-gable-lightwell', destination: '/projects/lilliput-mini-golf', permanent: true },
      { source: '/projects/waiheke-coastal-louvre', destination: '/projects/waiheke-holiday-home', permanent: true },
      { source: '/projects/waitakere-ranges-lanai', destination: '/projects/muriwai-courtyard', permanent: true },

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

      // Legacy portal paths -> portal domain
      { source: '/portal', destination: 'https://portal.sanctuarypergolas.co.nz/', permanent: true },
      { source: '/portal/:path*', destination: 'https://portal.sanctuarypergolas.co.nz/:path*', permanent: true },
      { source: '/staff', destination: 'https://portal.sanctuarypergolas.co.nz/staff/projects', permanent: true },
      { source: '/staff/:path*', destination: 'https://portal.sanctuarypergolas.co.nz/staff/:path*', permanent: true },
      { source: '/admin', destination: 'https://portal.sanctuarypergolas.co.nz/admin', permanent: true },
      { source: '/admin/:path*', destination: 'https://portal.sanctuarypergolas.co.nz/admin/:path*', permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Preserve the historic URL while allowing its 308 response to carry X-Robots-Tag.
        {
          source: '/downloads/Sanctuary-Pergolas-Brochure.pdf',
          destination: '/api/retired-pergola-brochure',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
