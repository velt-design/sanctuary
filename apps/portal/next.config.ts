import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enforce TypeScript correctness during production builds.
  typescript: { ignoreBuildErrors: false },
  // Ensure Turbopack treats this app folder as the workspace root.
  turbopack: { root: __dirname },
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
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googleadservices.com https://www.facebook.com https://graph.facebook.com https://pixel.archipro.co.nz https://*.supabase.co wss://*.supabase.co",
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
        source: '/careers/:path*',
        headers: [...securityHeaders, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
