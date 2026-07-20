import { afterEach, describe, expect, it } from 'vitest';

import { startWorkerHealthServer, type WorkerHealthServer, type WorkerHealthSnapshot } from './healthServer';

const openServers: WorkerHealthServer[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});
describe('worker health server', () => {
  it('serves cached liveness and readiness without executing asynchronous work', async () => {
    let reads = 0;
    let snapshot: WorkerHealthSnapshot = {
      mode: 'dark',
      lifecycleState: 'starting',
      activeJobCount: 0,
      acceptingJobs: false,
      databaseReachable: false,
      checkedAt: '2026-07-20T00:00:00.000Z',
    };
    const server = await startWorkerHealthServer({
      host: '127.0.0.1',
      port: 0,
      getSnapshot: () => {
        reads += 1;
        return snapshot;
      },
    });
    openServers.push(server);

    const live = await fetch(`http://127.0.0.1:${server.port}/livez`);
    const notReady = await fetch(`http://127.0.0.1:${server.port}/readyz`);
    expect(live.status).toBe(200);
    expect(notReady.status).toBe(503);

    snapshot = { ...snapshot, lifecycleState: 'ready', databaseReachable: true };
    const ready = await fetch(`http://127.0.0.1:${server.port}/readyz`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ status: 'ready', mode: 'dark' });
    expect(reads).toBe(3);
  });

  it('rejects non-GET methods and unknown paths without reading health state', async () => {
    let reads = 0;
    const server = await startWorkerHealthServer({
      host: '127.0.0.1',
      port: 0,
      getSnapshot: () => {
        reads += 1;
        return {
          mode: 'dark',
          lifecycleState: 'ready',
          activeJobCount: 0,
          acceptingJobs: false,
          databaseReachable: true,
          checkedAt: '2026-07-20T00:00:00.000Z',
        };
      },
    });
    openServers.push(server);

    expect((await fetch(`http://127.0.0.1:${server.port}/livez`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`http://127.0.0.1:${server.port}/metrics`)).status).toBe(404);
    expect(reads).toBe(0);
  });
});
