import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { externalDir: true },
  allowedDevOrigins: ['127.0.0.1'],
  transpilePackages: ['@sp/costing', '@sp/geometry', '@sp/quote-format', '@sp/theme'],
  // Enforce TypeScript correctness during production builds.
  typescript: { ignoreBuildErrors: false },
  // Allow monorepo package resolution for workspace packages.
  turbopack: { root: path.resolve(__dirname, '../..') },
  async headers() {
    const baseSecurityHeaders: { key: string; value: string }[] = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      // 6 months HSTS; include subdomains; preload optional if you submit to hstspreload.org
      { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
    ];

    const buildSecurityHeaders = (opts: { framePolicy: 'DENY' | 'SAMEORIGIN'; frameAncestors: "'none'" | "'self'" }) => {
      const headers: { key: string; value: string }[] = [
        ...baseSecurityHeaders,
        { key: 'X-Frame-Options', value: opts.framePolicy },
      ];
      if (process.env.NODE_ENV !== 'production') {
        return headers;
      }
      const csp = [
        "default-src 'self'",
        // Allow inline scripts so Next.js runtime and analytics can execute.
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://connect.facebook.net https://pixel.archipro.co.nz https://static.cloudflareinsights.com",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://www.google-analytics.com https://www.sanctuarypergolas.co.nz https://www.facebook.com https://stats.g.doubleclick.net https://www.googleadservices.com",
        "font-src 'self' data:",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googleadservices.com https://www.facebook.com https://graph.facebook.com https://pixel.archipro.co.nz https://*.supabase.co wss://*.supabase.co",
        "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com",
        "object-src 'none'",
        "base-uri 'self'",
        `frame-ancestors ${opts.frameAncestors}`,
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ');
      headers.push({ key: 'Content-Security-Policy', value: csp });
      return headers;
    };

    const securityHeaders = buildSecurityHeaders({ framePolicy: 'DENY', frameAncestors: "'none'" });
    const quotePdfPreviewHeaders = buildSecurityHeaders({ framePolicy: 'SAMEORIGIN', frameAncestors: "'self'" });

    return [
      {
        source: '/careers/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Keep the PDF rule last so it overrides the catch-all frame policy.
      {
        source: '/api/quotes/:quoteVersionId/pdf',
        headers: quotePdfPreviewHeaders,
      },
    ];
  },
};

export default nextConfig;
