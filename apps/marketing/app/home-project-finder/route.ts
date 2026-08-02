import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  buildProjectFinderHref,
  parseProjectFinderState,
} from '../_home-project-finder/projectFinderModel';

export function GET(request: NextRequest) {
  const state = parseProjectFinderState(request.nextUrl.searchParams);
  const destination = new URL(buildProjectFinderHref(state), request.url);
  const response = NextResponse.redirect(destination, 308);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
