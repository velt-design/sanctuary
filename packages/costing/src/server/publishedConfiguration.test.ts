import { describe, expect, it } from 'vitest';
import { loadCostingConfigV1, snapshotCostingControlConfigV1 } from '../index';
import {
  hashCostingControlConfigV1,
  resolvePublishedCostingConfigurationRecordV1,
} from './publishedConfiguration';

describe('published costing configuration boundary', () => {
  const control = snapshotCostingControlConfigV1(loadCostingConfigV1());
  const hash = hashCostingControlConfigV1(control);

  it('validates, hashes and applies a published record', () => {
    const resolved = resolvePublishedCostingConfigurationRecordV1({
      id: 'version-1',
      versionNumber: 12,
      status: 'published',
      config: control,
      contentHash: hash,
      baseManifestVersion: control.baseManifestVersion,
    });

    expect(resolved.provenance).toEqual({
      schemaVersion: 'costing-provenance.v1',
      source: 'published',
      versionId: 'version-1',
      versionNumber: 12,
      contentHash: hash,
      baseManifestVersion: control.baseManifestVersion,
    });
    expect(resolved.config.materials.items).toEqual(loadCostingConfigV1().materials.items);
  });

  it('fails closed for drafts or modified content', () => {
    expect(() => resolvePublishedCostingConfigurationRecordV1({
      id: 'draft-1',
      versionNumber: 13,
      status: 'draft',
      config: control,
      contentHash: hash,
      baseManifestVersion: control.baseManifestVersion,
    })).toThrow('does not reference a published version');

    expect(() => resolvePublishedCostingConfigurationRecordV1({
      id: 'version-2',
      versionNumber: 14,
      status: 'published',
      config: control,
      contentHash: '0'.repeat(64),
      baseManifestVersion: control.baseManifestVersion,
    })).toThrow('failed its content hash check');
  });
});
