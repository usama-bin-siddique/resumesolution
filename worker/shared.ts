export type Statement = {
  bind: (...args: unknown[]) => Statement;
  first: () => Promise<any>;
  all: () => Promise<{results: any[]}>;
  run: () => Promise<{meta: {changes: number}}>;
};
export type Database = {prepare: (sql: string) => Statement; batch: (statements: Statement[]) => Promise<any[]>};
export type Env = {GROQ_API_KEY?: string; DB?: Database; ASSETS?: {fetch: (request: Request) => Promise<Response>}};
export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', ...extra,
  }});
}
export function db(env: Env): Database {
  if (!env.DB) throw new Error('DB_UNAVAILABLE');
  return env.DB;
}
export async function readJSON(request: Request, limit = 8192) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new InputError('Expected JSON.', 415);
  if (Number(request.headers.get('content-length') || 0) > limit) throw new InputError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Request body is missing.', 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {await reader.cancel(); throw new InputError('Request is too large.', 413);}
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  try {const result = JSON.parse(new TextDecoder().decode(bytes)); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result;}
  catch {throw new InputError('Invalid JSON.', 400);}
}
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {super(message); this.status = status;}
}
