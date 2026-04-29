import { describe, expect, it } from 'vitest';
import {
  makeObjectFirstWorkbenchProjectFixture,
} from './objectFirstWorkbenchFixtures';

describe('object-first workbench fixtures', () => {
  it('covers two separate house forms without derived wall merging', () => {
    const fixture = makeObjectFirstWorkbenchProjectFixture('separate_forms');
    const envelope = fixture.houseAssembly?.derivedEnvelope;

    expect(fixture.houseAssembly?.houseForms.map((form) => form.id)).toEqual(['form-a', 'form-b']);
    expect(envelope?.wallGraph.mergeGroups).toEqual([]);
    expect(envelope?.wallGraph.walls.map((wall) => wall.sourceFormIds)).toEqual([['form-a'], ['form-b']]);
    expect(envelope?.attachmentZones.map((zone) => zone.hostEdgeId)).toEqual(['edge-a-eave', 'edge-b-eave']);
    expect(fixture.openings.map((opening) => opening.hostWallId)).toEqual(['wall-a-rear', 'wall-b-rear']);
    expect(fixture.pergolas.map((pergola) => pergola.attachmentEdgeId)).toEqual(['edge-a-eave', 'edge-b-eave']);
  });

  it('covers touching forms merged into assembly-level derived walls and zones', () => {
    const fixture = makeObjectFirstWorkbenchProjectFixture('touching_merged_forms');
    const envelope = fixture.houseAssembly?.derivedEnvelope;

    expect(fixture.houseAssembly?.houseForms.map((form) => form.transform.offsetXM)).toEqual([0, 6]);
    expect(envelope?.mergedFormIds).toEqual(['form-a', 'form-b']);
    expect(envelope?.wallGraph.mergeGroups).toEqual([
      {
        id: 'merge-touching-rear',
        sourceFormIds: ['form-a', 'form-b'],
        wallIds: ['wall-merged-rear'],
      },
    ]);
    expect(envelope?.wallGraph.walls[0]).toMatchObject({
      id: 'wall-merged-rear',
      sourceFormIds: ['form-a', 'form-b'],
    });
    expect(envelope?.edges[0]).toMatchObject({
      id: 'edge-merged-eave',
      hostWallId: 'wall-merged-rear',
      sourceFormIds: ['form-a', 'form-b'],
    });
    expect(envelope?.attachmentZones[0]).toMatchObject({
      id: 'zone-merged-soffit',
      hostWallId: 'wall-merged-rear',
      hostEdgeId: 'edge-merged-eave',
      sourceFormIds: ['form-a', 'form-b'],
    });
  });

  it('covers stale hosted-object references without removing the derived assembly truth', () => {
    const fixture = makeObjectFirstWorkbenchProjectFixture('stale_hosts');
    const wallIds = new Set(fixture.houseAssembly?.derivedEnvelope?.wallGraph.walls.map((wall) => wall.id) ?? []);
    const edgeIds = new Set(fixture.houseAssembly?.derivedEnvelope?.edges.map((edge) => edge.id) ?? []);

    expect(fixture.openings[0]?.hostWallId).toBe('wall-removed');
    expect(fixture.pergolas[0]?.attachmentEdgeId).toBe('edge-removed');
    expect(wallIds.has('wall-removed')).toBe(false);
    expect(edgeIds.has('edge-removed')).toBe(false);
    expect(fixture.houseAssembly?.derivedEnvelope?.wallGraph.walls.map((wall) => wall.id)).toContain('wall-merged-rear');
    expect(fixture.warnings).toHaveLength(1);
  });
});
