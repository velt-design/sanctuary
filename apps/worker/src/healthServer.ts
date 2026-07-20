import { createServer, type Server } from 'node:http';

import type { BackgroundJobWorkerLifecycleState, BackgroundJobWorkerMode } from '@sp/jobs';

export type WorkerHealthSnapshot = Readonly<{
  mode: BackgroundJobWorkerMode;
  lifecycleState: BackgroundJobWorkerLifecycleState;
  activeJobCount: number;
  acceptingJobs: boolean;
  databaseReachable: boolean;
  checkedAt: string;
}>;

export type WorkerHealthServer = Readonly<{
  host: string;
  port: number;
  close(): Promise<void>;
}>;

type StartWorkerHealthServerOptions = Readonly<{
  host: string;
  port: number;
  getSnapshot: () => WorkerHealthSnapshot;
}>;

function responseBody(pathname: '/livez' | '/readyz', snapshot: WorkerHealthSnapshot) {
  const ready = snapshot.lifecycleState === 'ready' && snapshot.databaseReachable;
  return {
    status: pathname === '/livez' ? 'live' : ready ? 'ready' : 'not_ready',
    mode: snapshot.mode,
    lifecycleState: snapshot.lifecycleState,
    activeJobCount: snapshot.activeJobCount,
    acceptingJobs: snapshot.acceptingJobs,
    checkedAt: snapshot.checkedAt,
  } as const;
}
function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function startWorkerHealthServer(
  options: StartWorkerHealthServerOptions,
): Promise<WorkerHealthServer> {
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      response.writeHead(405);
      response.end(JSON.stringify({ status: 'method_not_allowed' }));
      return;
    }

    const pathname = new URL(request.url ?? '/', 'http://worker.local').pathname;
    if (pathname !== '/livez' && pathname !== '/readyz') {
      response.writeHead(404);
      response.end(JSON.stringify({ status: 'not_found' }));
      return;
    }

    const snapshot = options.getSnapshot();
    const ready = snapshot.lifecycleState === 'ready' && snapshot.databaseReachable;
    response.writeHead(pathname === '/readyz' && !ready ? 503 : 200);
    response.end(JSON.stringify(responseBody(pathname, snapshot)));
  });

  await listen(server, options.port, options.host);
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : options.port;

  return Object.freeze({
    host: options.host,
    port: boundPort,
    close: () => close(server),
  });
}
