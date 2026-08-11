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

  it('verifies the stored hash before hydrating compatible v2.5 material additions', () => {
    const historical = structuredClone(control);
    historical.baseManifestVersion = 'v2.4';
    delete historical.materialRatesExGst.powdercoating_200x50_6m_assumption;
    delete historical.materialRatesExGst.powdercoating_overhang_gutter_100x100_6m_assumption;
    const historicalHash = hashCostingControlConfigV1(historical);

    const resolved = resolvePublishedCostingConfigurationRecordV1({
      id: 'version-v2-4',
      versionNumber: 11,
      status: 'published',
      config: historical,
      contentHash: historicalHash,
      baseManifestVersion: 'v2.4',
    });

    expect(resolved.provenance.contentHash).toBe(historicalHash);
    expect(resolved.config.materials.items.find((item) => item.id === 'powdercoating_200x50_6m_assumption')?.cost_ex_gst).toBe(40.4853);
  });
});
