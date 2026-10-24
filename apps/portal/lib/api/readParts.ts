/** Bounded NDJSON transport for request-owned read parts. Domain owners validate each frame. */
export const READ_PARTS_MEDIA_TYPE = 'application/x-ndjson';
export function readPartsResponse(request: Request, run: (emit: (frame: unknown) => void, signal: AbortSignal) => Promise<void>, maxBytes: number): Response {
  const controller = new AbortController();
  const encoder = new TextEncoder();
  let bytes = 0;
  let closed = false;
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const stop = () => {
    if (closed) return;
    closed = true;
    controller.abort();
    streamController.close();
  };
  const onAbort = () => stop();
  const stream = new ReadableStream<Uint8Array>({
    start(target) {
      streamController = target;
      request.signal.addEventListener('abort', onAbort, {once:true});
      const emit = (frame: unknown) => {
        if (closed || controller.signal.aborted) return;
        const chunk = encoder.encode(JSON.stringify(frame) + '\n');
        bytes += chunk.byteLength;
        if (bytes > maxBytes) throw new Error('Read response exceeded its size limit.');
        target.enqueue(chunk);
      };
      if (request.signal.aborted) { stop(); return; }
      void run(emit, controller.signal).catch(error => {
        if (closed) return;
        const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
        // Generic transport failures contain no private source payload.
        try { emit({error:'The read could not complete. Retry to read current information.',status}); } catch { closed=true;controller.abort();target.error(new Error('Read response exceeded its size limit.')); }
      }).finally(() => {
        request.signal.removeEventListener('abort', onAbort);
        if (!closed) {closed=true;target.close();}
      });
    },
    cancel() {closed=true;controller.abort();request.signal.removeEventListener('abort',onAbort);},
  });
  return new Response(stream,{headers:{'content-type':READ_PARTS_MEDIA_TYPE,'cache-control':'private, no-store','vary':'Accept','x-content-type-options':'nosniff'}});
}
export async function consumeReadParts(response: Response, signal: AbortSignal, maxBytes: number, consume: (frame: unknown) => void): Promise<void> {
  if (!response.body) throw new Error('The read response has no body.');
  const reader=response.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,buffer='';
  const abort=()=>{void reader.cancel();};
  signal.addEventListener('abort',abort,{once:true});
  try {
    if(signal.aborted) throw new DOMException('Read cancelled','AbortError');
    while(true){
      const {done,value}=await reader.read();
      if(signal.aborted) throw new DOMException('Read cancelled','AbortError');
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>maxBytes)throw new Error('Read response exceeded its size limit.');
      buffer+=decoder.decode(value,{stream:true});
      let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
        if(!line)throw new Error('Invalid read frame.');
        consume(JSON.parse(line));
      }
    }
    buffer+=decoder.decode();
    if(buffer)throw new Error('Incomplete read response.');
  } finally {signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
