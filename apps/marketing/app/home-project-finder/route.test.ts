import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('retired project finder route', () => {
  it('permanently redirects to the root with query state and noindex intact', () => {
    const response = GET(new NextRequest(
      'https://www.sanctuarypergolas.co.nz/home-project-finder?project=bespoke&priorities=daylight%2Ccoordination',
    ));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://www.sanctuarypergolas.co.nz/?project=bespoke&priorities=daylight%2Ccoordination',
    );
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('strips invalid, duplicate and arbitrary values from the canonical URL', () => {
    const invalid = GET(new NextRequest(
      'https://www.sanctuarypergolas.co.nz/home-project-finder?project=invalid&priorities=daylight&free_text=secret',
    ));
    const duplicate = GET(new NextRequest(
      'https://www.sanctuarypergolas.co.nz/home-project-finder?project=cover&project=bespoke&free_text=secret',
    ));

    expect(invalid.headers.get('location')).toBe(
      'https://www.sanctuarypergolas.co.nz/',
    );
    expect(duplicate.headers.get('location')).toBe(
      'https://www.sanctuarypergolas.co.nz/',
    );
  });

  it('keeps valid finder state while dropping unrelated query values', () => {
    const response = GET(new NextRequest(
      'https://www.sanctuarypergolas.co.nz/home-project-finder?project=cover&priorities=shade%2Cdaylight&free_text=secret',
    ));

    expect(response.headers.get('location')).toBe(
      'https://www.sanctuarypergolas.co.nz/?project=cover&priorities=daylight%2Cshade',
    );
  });
});
