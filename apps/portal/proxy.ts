import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_FILE = /\.(.*)$/;

function requiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

async function applySupabaseSession(req: NextRequest, res: NextResponse) {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) return res;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getSession();
  return res;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;

  // Never touch Next internals / API / static files
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/favicon') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    PUBLIC_FILE.test(path)
  ) {
    const res = NextResponse.next();
    return applySupabaseSession(req, res);
  }

  // Legacy: /staff/pricebook -> /pricebook
  if (path === '/staff/pricebook' || path.startsWith('/staff/pricebook/')) {
    const stripped = path.replace(/^\/staff\/pricebook/, '');
    url.pathname = stripped ? `/pricebook${stripped}` : '/pricebook';
    const res = NextResponse.redirect(url, 308);
    return applySupabaseSession(req, res);
  }

  // Clean: /imports -> /admin/imports
  if (path === '/imports' || path.startsWith('/imports/')) {
    const stripped = path.replace(/^\/imports/, '');
    url.pathname = stripped ? `/admin/imports${stripped}` : '/admin/imports';
    const res = NextResponse.rewrite(url);
    return applySupabaseSession(req, res);
  }

  // Keep these routes as-is
  if (
    path === '/staff' || path.startsWith('/staff/') ||
    path === '/admin' || path.startsWith('/admin/') ||
    path === '/pricebook' || path.startsWith('/pricebook/') ||
    path === '/dashboard' || path.startsWith('/dashboard/') ||
    path === '/login' || path.startsWith('/login/')
  ) {
    const res = NextResponse.next();
    return applySupabaseSession(req, res);
  }

  // Clean root -> staff projects
  if (path === '/') {
    url.pathname = '/dashboard';
    const res = NextResponse.redirect(url, 308);
    return applySupabaseSession(req, res);
  }

  // Clean paths -> /staff/*
  url.pathname = `/staff${path}`;
  const res = NextResponse.rewrite(url);
  return applySupabaseSession(req, res);
}

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
