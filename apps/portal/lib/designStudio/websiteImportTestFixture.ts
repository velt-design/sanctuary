const design = { version: 1, input: { widthMm: 6500, projectionMm: 3500, level: 'ground', connection: 'soffit' }, roof: { family: 'mono', orientation: 'parallel', infills: false, attachmentIntent: 'freestanding' } };
const enrichment = { heightM: '2.70', pitchDeg: '5', postCount: '4', postConnectionType: 'slab_anchors', ground: 'easy', ledgerProfile: '', frontBeamProfile: '150x50', rafterProfile: '150x50', postProfile: '100x100' };
const source = { id: '10000000-0000-4000-8000-000000000001', project_id: '20000000-0000-4000-8000-000000000001', commercial_scope_id: null, status: 'draft', updated_at: '2026-09-25T00:00:00Z', inputs: { private: 'preserve' }, outputs: { snapshot: { customerBrief: { version: 1, audience: 'residential', designStatus: 'configured', design, summary: 'untrusted', reopenPath: 'https://bad.test' }, frozenConfiguratorPrice: { price: 123 } } } };
const input = { projectId: source.project_id, designId: '30000000-0000-4000-8000-000000000001', pergolaId: '40000000-0000-4000-8000-000000000001', source, enrichment };

export function makeStudioWebsiteImportTestFixture() { return structuredClone(input); }
