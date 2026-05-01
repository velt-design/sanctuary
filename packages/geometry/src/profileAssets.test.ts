import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GENERATED_PROFILE_ASSETS } from './generated/profileAssets';
import {
  parseClosedProfileDxf,
  serializeGeneratedProfileAssetsModule,
} from './profileAssets';
import { parseAssemblyMemberProfile } from './profiles';

const GUTTER_ASSET_PATH = path.resolve(process.cwd(), 'packages/geometry/assets/profiles/mono/sp-gutter.dxf');
const JOINER_ASSET_PATH = path.resolve(process.cwd(), 'packages/geometry/assets/profiles/mono/sp-joiners.dxf');
const GENERATED_ASSET_MODULE_PATH = path.resolve(process.cwd(), 'packages/geometry/src/generated/profileAssets.ts');
const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n');
const OLD_PROXY_OUTLINE = [
  { x: -50, y: -75 },
  { x: 50, y: -75 },
  { x: 50, y: 75 },
  { x: 40, y: 75 },
  { x: 40, y: -65 },
  { x: -40, y: -65 },
  { x: -40, y: 75 },
  { x: -50, y: 75 },
];

describe('profile asset DXF normalization', () => {
  it('parses a clean closed-polyline profile into a centered outline and void set', () => {
    const parsed = parseClosedProfileDxf(
      [
        '0',
        'SECTION',
        '2',
        'ENTITIES',
        '0',
        'LWPOLYLINE',
        '90',
        '4',
        '70',
        '1',
        '10',
        '10',
        '20',
        '20',
        '10',
        '30',
        '20',
        '20',
        '10',
        '30',
        '20',
        '30',
        '10',
        '10',
        '20',
        '30',
        '0',
        'LWPOLYLINE',
        '90',
        '4',
        '70',
        '1',
        '10',
        '14',
        '20',
        '24',
        '10',
        '26',
        '20',
        '24',
        '10',
        '26',
        '20',
        '26',
        '10',
        '14',
        '20',
        '26',
        '0',
        'ENDSEC',
        '0',
        'EOF',
      ].join('\n'),
      'inline-test.dxf',
    );

    expect(parsed).toEqual({
      widthMm: 20,
      depthMm: 10,
      sectionOutline: [
        { x: -10, y: -5 },
        { x: 10, y: -5 },
        { x: 10, y: 5 },
        { x: -10, y: 5 },
      ],
      sectionVoids: [
        [
          { x: -6, y: -1 },
          { x: 6, y: -1 },
          { x: 6, y: 1 },
          { x: -6, y: 1 },
        ],
      ],
    });
  });

  it('parses stitched LINE and degree-1 SPLINE geometry into a closed outer profile loop', () => {
    const parsed = parseClosedProfileDxf(
      [
        '0',
        'SECTION',
        '2',
        'ENTITIES',
        '0',
        'LINE',
        '10',
        '0',
        '20',
        '0',
        '11',
        '20',
        '21',
        '0',
        '0',
        'SPLINE',
        '71',
        '1',
        '40',
        '0',
        '40',
        '0',
        '40',
        '1',
        '40',
        '1',
        '10',
        '20',
        '20',
        '0',
        '10',
        '20',
        '20',
        '10',
        '0',
        'LINE',
        '10',
        '20',
        '20',
        '10',
        '11',
        '0',
        '21',
        '10',
        '0',
        'LINE',
        '10',
        '0',
        '20',
        '10',
        '11',
        '0',
        '21',
        '0',
        '0',
        'ENDSEC',
        '0',
        'EOF',
      ].join('\n'),
      'line-spline-profile.dxf',
    );

    expect(parsed).toEqual({
      widthMm: 20,
      depthMm: 10,
      sectionOutline: [
        { x: -10, y: -5 },
        { x: 10, y: -5 },
        { x: 10, y: 5 },
        { x: -10, y: 5 },
      ],
      sectionVoids: null,
    });
  });

  it('rejects unsupported DXF entities in the ENTITIES section with a debuggable error', () => {
    expect(() =>
      parseClosedProfileDxf(
        ['0', 'SECTION', '2', 'ENTITIES', '0', 'ARC', '0', 'ENDSEC', '0', 'EOF'].join('\n'),
        'bad-profile.dxf',
      ),
    ).toThrowError('bad-profile.dxf: unsupported DXF entity types in ENTITIES section: ARC.');
  });

  it('keeps the generated profile asset module in sync with the canonical gutter and joiner DXFs', () => {
    const parsedGutter = parseClosedProfileDxf(fs.readFileSync(GUTTER_ASSET_PATH, 'utf8'), GUTTER_ASSET_PATH);
    const parsedJoiners = parseClosedProfileDxf(fs.readFileSync(JOINER_ASSET_PATH, 'utf8'), JOINER_ASSET_PATH);
    const generated = serializeGeneratedProfileAssetsModule({
      sp_gutter: parsedGutter,
      sp_joiners: parsedJoiners,
    });

    expect(parsedGutter.widthMm).toBe(100);
    expect(parsedGutter.depthMm).toBe(150.568624);
    expect(parsedGutter.sectionOutline).not.toEqual(OLD_PROXY_OUTLINE);
    expect(parsedGutter.sectionOutline).toHaveLength(12);
    expect(parsedGutter.sectionVoids).toHaveLength(2);
    expect(parsedJoiners.widthMm).toBe(50);
    expect(parsedJoiners.depthMm).toBe(16);
    expect(parsedJoiners.sectionOutline).toHaveLength(20);
    expect(parsedJoiners.sectionVoids).toBeNull();
    expect(GENERATED_PROFILE_ASSETS.sp_gutter).toEqual(parsedGutter);
    expect(GENERATED_PROFILE_ASSETS.sp_joiners).toEqual(parsedJoiners);
    expect(normalizeLineEndings(fs.readFileSync(GENERATED_ASSET_MODULE_PATH, 'utf8'))).toBe(
      normalizeLineEndings(generated),
    );
  });

  it('uses the generated gutter asset as the runtime source for the SP gutter profile', () => {
    const profile = parseAssemblyMemberProfile('SP Gutter');

    expect(profile?.profileKey).toBe('sp_gutter');
    expect(profile?.sectionOutline).toEqual(GENERATED_PROFILE_ASSETS.sp_gutter.sectionOutline);
    expect(profile?.widthMm).toBe(GENERATED_PROFILE_ASSETS.sp_gutter.widthMm);
    expect(profile?.depthMm).toBe(GENERATED_PROFILE_ASSETS.sp_gutter.depthMm);
  });

  it('uses the generated joiner asset as the runtime source for the SP joiners profile', () => {
    const profile = parseAssemblyMemberProfile('SP Joiners');

    expect(profile?.profileKey).toBe('sp_joiners');
    expect(profile?.shape).toBe('custom');
    expect(profile?.sectionOutline).toEqual(GENERATED_PROFILE_ASSETS.sp_joiners.sectionOutline);
    expect(profile?.widthMm).toBe(GENERATED_PROFILE_ASSETS.sp_joiners.widthMm);
    expect(profile?.depthMm).toBe(GENERATED_PROFILE_ASSETS.sp_joiners.depthMm);
  });
});
