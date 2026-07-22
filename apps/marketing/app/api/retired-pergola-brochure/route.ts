import { NextResponse } from 'next/server';

function retiredBrochureResponse(request: Request) {
  const response = NextResponse.redirect(new URL('/pergola-guides', request.url), 308);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const GET = retiredBrochureResponse;
export const HEAD = retiredBrochureResponse;
