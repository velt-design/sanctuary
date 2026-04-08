import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { solveAssembly3D, validateGeometrySolve } from '@sp/geometry';
import { getGeometryFixtureCase, listGeometryFixtureCases } from './fixtures';

function requireFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture) {
    throw new Error(`Missing geometry fixture: ${id}`);
  }
  return fixture;
}

function readFilesRecursively(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return readFilesRecursively(fullPath);
    }
    return entry.name.endsWith('.ts') ? [fs.readFileSync(fullPath, 'utf8')] : [];
  });
}

describe('validateGeometrySolve', () => {
  it('passes every supported golden fixture', () => {
    const supportedFixtures = listGeometryFixtureCases().filter((fixture) => fixture.kind === 'supported');

    for (const fixture of supportedFixtures) {
      const solveResult = solveAssembly3D(fixture.config);
      if (!solveResult.ok) {
        throw new Error(`Expected supported fixture ${fixture.id} to solve, but got: ${solveResult.error}`);
      }

      const report = validateGeometrySolve({
        config: fixture.config,
        solveResult,
        fixtureId: fixture.id,
      });

      expect(report.status, fixture.id).toBe('pass');
      expect(report.invariants.every((invariant) => invariant.status === 'pass'), fixture.id).toBe(true);
      expect(report.fixtureComparisons).toHaveLength(1);
      expect(report.fixtureComparisons[0]).toMatchObject({
        fixtureId: fixture.id,
        status: 'match',
      });
    }
  });

  it('returns unsupported reports for every unsupported fixture', () => {
    const unsupportedFixtures = listGeometryFixtureCases().filter((fixture) => fixture.kind === 'unsupported');

    for (const fixture of unsupportedFixtures) {
      const solveResult = solveAssembly3D(fixture.config);
      expect(solveResult.ok, fixture.id).toBe(false);
      if (solveResult.ok) {
        continue;
      }

      const report = validateGeometrySolve({
        config: fixture.config,
        solveResult,
        fixtureId: fixture.id,
      });

      expect(report.status, fixture.id).toBe('unsupported');
      expect(report.unsupportedReasons[0], fixture.id).toContain(fixture.expectedMessageIncludes);
      expect(report.fixtureComparisons).toHaveLength(1);
      expect(report.fixtureComparisons[0]).toMatchObject({
        fixtureId: fixture.id,
        status: 'match',
      });
    }
  });

  it('fails when invariants drift even without fixture comparison', () => {
    const fixture = requireFixture('mono_attached_soffit_away_standard');
    if (fixture.kind !== 'supported') {
      throw new Error('Expected supported mono fixture.');
    }

    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    const post = mutated.members.find((member) => member.role === 'post');
    if (!post) {
      throw new Error('Expected mono assembly to contain a post.');
    }
    post.centerline.end.x += 25;

    const report = validateGeometrySolve({
      config: fixture.config,
      solveResult: { ok: true, value: mutated },
    });

    expect(report.status).toBe('fail');
    expect(report.invariants).toContainEqual(
      expect.objectContaining({
        key: 'posts.vertical',
        status: 'fail',
      }),
    );
  });

  it('fails with a debuggable fixture drift summary when a supported assembly changes', () => {
    const fixture = requireFixture('box_attached_standard');
    if (fixture.kind !== 'supported') {
      throw new Error('Expected supported box fixture.');
    }

    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    const outerGutter = mutated.members.find((member) => member.id === 'outer-gutter');
    if (!outerGutter) {
      throw new Error('Expected box assembly to contain outer-gutter.');
    }
    outerGutter.centerline.start.z += 10;

    const report = validateGeometrySolve({
      config: fixture.config,
      solveResult: { ok: true, value: mutated },
      fixtureId: fixture.id,
    });

    expect(report.status).toBe('fail');
    expect(report.fixtureComparisons).toHaveLength(1);
    expect(report.fixtureComparisons[0]).toMatchObject({
      fixtureId: fixture.id,
      status: 'drift',
    });
    expect(report.fixtureComparisons[0]?.message).toContain('members.outer-gutter.centerline.start.z');
  });

  it('keeps fixtures and validation code free of portal, React, and SVG view-model dependencies', () => {
    const fixtureSource = readFilesRecursively(path.resolve(__dirname, 'fixtures')).join('\n');
    const validationSource = readFilesRecursively(path.resolve(__dirname, 'validation')).join('\n');
    const source = `${fixtureSource}\n${validationSource}`;

    expect(source).not.toContain('apps/portal');
    expect(source).not.toContain("from 'react'");
    expect(source).not.toContain('ModulePlanModel');
    expect(source).not.toContain('ModuleSectionModel');
    expect(source).not.toContain('design-workbench');
    expect(source).not.toContain('svg');
  });
});
