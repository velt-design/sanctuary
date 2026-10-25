"use client";
import { useLayoutEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProjectSnapshotPageClient from '@/app/staff/projects/[projectId]/ProjectSnapshotPageClient';
import type { ProjectWorkReadLoaders } from '@/lib/projects/projectWorkInitialRead';
import { commandCentreFixtures, commandCentreOverviewFixtureProject, commandCentreWorkFixtures } from '../project-command-centre-fixture/fixtures';
import { schedule } from '../project-page-shell-fixture/commercialClarityData';
import { visitsFixture } from './data';

const projectFixtureId = (choice: string) => choice === 'b' ? 'proj_progressive_b' : 'proj_progressive_a';
export function projectFixtureSnapshot(id: string) {
  const label = id === projectFixtureId('b') ? 'Fictional harbour' : 'Fictional courtyard';
  return { workModel: 'v2' as const, project: { ...commandCentreOverviewFixtureProject, id, name: label, contactName: 'Fictional household', owner: undefined, hasJobPacks: true },
    pipeline: { stage: commandCentreOverviewFixtureProject.stage }, activity: [], emails: [], notes: [] };
}
function projectFixtureLoaders(failures = 0): ProjectWorkReadLoaders {
  const failed: Record<string, number> = {};
  const wait = async (id: string, kind: string, delay: number) => {
    const key = id + kind;
    await new Promise(resolve => setTimeout(resolve, delay));
    if ((failed[key] ?? 0) < failures) { failed[key] = (failed[key] ?? 0) + 1; throw new Error('Synthetic project read failed. Retry reads the same fictional source.'); }
  };
  return {
    summary: async id => { await wait(id, 'summary', 1200); return { snapshot: projectFixtureSnapshot(id), generatedAt: new Date().toISOString() }; },
    snapshot: async id => { await wait(id, 'snapshot', 2400); return { snapshot: projectFixtureSnapshot(id), generatedAt: new Date().toISOString() }; },
    command: async id => { await wait(id, 'command', 650); return { projectId: id, workModel: 'v2', generatedAt: new Date().toISOString(),
      currentDesign: commandCentreFixtures['standard-estimate'], projectWork: { ...commandCentreWorkFixtures['v2-triage'].projectWork, projectId: id },
      owner: { owner: null, required: false, missing: false, version: null, permissions: { canManage: false } } }; },
    payment: async id => { await wait(id, 'payment', 900); return schedule; },
  };
}

/** Ancillary reads remain fictional and writes cannot reach any server. The main four reads use their actual query owners. */
export default function ProjectJourney() {
  const params = useSearchParams(), router = useRouter();
  const projectId = projectFixtureId(params.get('project') ?? 'a');
  const [loaders] = useState(() => projectFixtureLoaders(params.get('projectFailure') === '1' ? 1 : 0));
  useLayoutEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
      if (!url.pathname.startsWith('/api/')) return original(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      if (method !== 'GET') return reply({ error: 'Fictional read-only preview: no command was sent.' }, 405);
      if (url.pathname.includes('calendar') || url.pathname.includes('site-visits')) return reply({ ...visitsFixture(), events: [] });
      if (url.pathname.endsWith('/correspondence')) return reply({ state: 'not_connected' });
      if (url.pathname.endsWith('/enquiry-attachments')) return reply({ attachments: [], generatedAt: new Date().toISOString() });
      if (url.pathname.includes('job-packs')) return reply({ jobPacks: [] });
      return reply({ error: 'This ancillary source is unavailable in the fictional journey.' }, 503);
    };
    return () => { window.fetch = original; };
  }, []);
  return <div onClickCapture={event => {
    const anchor = (event.target as HTMLElement).closest('a[href]');
    if (anchor?.getAttribute('href') === '/staff/projects') {
      event.preventDefault(); event.stopPropagation(); router.push('/qa/portal-progressive-fixture?view=sheet');
    }
  }}><p>Actual project page client. Fictional work 650 ms, payments 900 ms, summary 1200 ms, full snapshot 2400 ms. Commands are unavailable. The Projects return opens the fictional list workspace.</p>
    <nav aria-label="Fictional projects">{['a', 'b'].map(choice => <button key={choice} type="button" onClick={() => {
      const query = new URLSearchParams(params); query.set('project', choice); router.push('/qa/portal-progressive-fixture?' + query);
    }}>Project {choice.toUpperCase()}</button>)}</nav>
    <ProjectSnapshotPageClient projectId={projectId} tab={params.get('tab') ?? 'activity'} estimateId={null} debugExportEnabled={false} readLoaders={loaders} readOnly />
  </div>;
}
