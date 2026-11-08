// Structured logging for Supabase Edge Functions → bb-log-bridge → Loki (Grafana).
//
// Every entry is (1) printed as one JSON line so it is searchable in the Supabase dashboard
// and (2) buffered and shipped to the bridge once the request finishes.
//   Grafana: {app="plan-my-c-day", platform="edge", logger="<function-name>"} | json
//
// Secrets (Edge Functions → Secrets):
//   LOG_BRIDGE_SECRET   required to ship; without it logs only go to the dashboard
//   LOG_ENV             "production" (default) or "staging"
//   LOG_BRIDGE_URL      default https://logs.starterschool.com/v1/logs
//
// Usage:
//   import { withLogging } from '../_shared/logger.ts';
//   Deno.serve(withLogging('my-function', async (req, log) => {
//     log.info('did_thing', { id });
//     return new Response('ok');
//   }));

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;
type Entry = { ts: number; level: Level; logger: string; msg: string; fields: Record<string, unknown> };

export type FnLogger = {
  readonly requestId: string;
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  /** Adds fields to every later entry (e.g. caller_user_id once known). */
  bind(fields: Fields): void;
  /** Ships buffered entries to the bridge. Never throws. */
  flush(): Promise<void>;
};

const APP = 'plan-my-c-day';
const BRIDGE_URL = Deno.env.get('LOG_BRIDGE_URL') ?? 'https://logs.starterschool.com/v1/logs';
const BRIDGE_SECRET = Deno.env.get('LOG_BRIDGE_SECRET') ?? '';
const ENV = Deno.env.get('LOG_ENV') === 'staging' ? 'staging' : 'production';
const MAX_ENTRIES_PER_INVOCATION = 1000;
const BATCH_SIZE = 500;
const SHIP_TIMEOUT_MS = 3000;

const SENSITIVE_KEYS = new Set(['password', 'token', 'access_token', 'refresh_token', 'secret', 'authorization', 'apikey', 'api_key', 'otp', 'cookie', 'service_role_key', 'date_of_birth', 'dob', 'phone', 'phone_number']);
const SENSITIVE_SUFFIX = /(_token|_secret|_key|password)$/i;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const BEARER = /\b(Bearer)\s+[\w.~+/-]+=*/gi;
const scrub = (s: string) => s.replace(JWT, '[jwt]').replace(BEARER, '$1 [redacted]');

export function serializeError(error: unknown): Record<string, unknown> {
  if (error === null || typeof error !== 'object') return { message: scrub(String(error)).slice(0, 2000) };
  const e = error as Record<string, unknown>;
  const out: Record<string, unknown> = {
    name: typeof e.name === 'string' ? e.name : undefined,
    message: typeof e.message === 'string' ? scrub(e.message).slice(0, 2000) : scrub(String(error)).slice(0, 2000),
  };
  for (const k of ['code', 'status', 'details', 'hint']) if (e[k] !== undefined && e[k] !== null) out[k] = sanitize(e[k], 3);
  if (typeof e.stack === 'string') out.stack = scrub(e.stack).split('\n').slice(0, 12).join('\n');
  return out;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return scrub(value).slice(0, 2000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();
  if (depth >= 5) return '[depth]';
  if (Array.isArray(value)) return value.slice(0, 50).map(v => sanitize(v, depth + 1));
  const obj = value as Record<string, unknown>;
  if (typeof obj.message === 'string' && ('code' in obj || 'status' in obj) && depth > 0) return serializeError(obj);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj).slice(0, 50)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_SUFFIX.test(k)) { out[k] = '[redacted]'; continue; }
    const clean = sanitize(v, depth + 1);
    if (clean !== undefined) out[k] = clean;
  }
  return out;
}

export function createFnLogger(fn: string, requestId: string = crypto.randomUUID()): FnLogger {
  const entries: Entry[] = [];
  const bound: Fields = {};
  let dropped = 0;

  const push = (level: Level, msg: string, fields?: Fields) => {
    const clean = sanitize({ ...bound, ...(fields ?? {}) }) as Record<string, unknown>;
    const ts = Date.now();
    // One JSON line per entry for the Supabase dashboard / `supabase functions logs`.
    const line = JSON.stringify({ ts: new Date(ts).toISOString(), level, function: fn, request_id: requestId, msg, ...clean });
    if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
    if (entries.length >= MAX_ENTRIES_PER_INVOCATION) { dropped++; return; }
    entries.push({ ts, level, logger: fn, msg, fields: clean });
  };

  return {
    requestId,
    debug: (m, f) => push('debug', m, f),
    info: (m, f) => push('info', m, f),
    warn: (m, f) => push('warn', m, f),
    error: (m, f) => push('error', m, f),
    bind: (f) => Object.assign(bound, f),
    async flush() {
      if (dropped) { entries.push({ ts: Date.now(), level: 'warn', logger: fn, msg: 'log_entries_dropped', fields: { dropped_count: dropped } }); dropped = 0; }
      if (!BRIDGE_SECRET || entries.length === 0) { entries.length = 0; return; }
      const pending = entries.splice(0, entries.length);
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        try {
          const res = await fetch(BRIDGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BRIDGE_SECRET}` },
            body: JSON.stringify({
              app: APP,
              env: ENV,
              platform: 'edge',
              context: {
                function: fn,
                request_id: requestId,
                region: Deno.env.get('SB_REGION') ?? undefined,
                execution_id: Deno.env.get('SB_EXECUTION_ID') ?? undefined,
                deployment_id: Deno.env.get('DENO_DEPLOYMENT_ID') ?? undefined,
              },
              entries: pending.slice(i, i + BATCH_SIZE),
            }),
            signal: AbortSignal.timeout(SHIP_TIMEOUT_MS),
          });
          if (!res.ok) console.warn(JSON.stringify({ level: 'warn', function: fn, msg: 'log_ship_failed', status: res.status }));
        } catch (error) {
          console.warn(JSON.stringify({ level: 'warn', function: fn, msg: 'log_ship_failed', error: serializeError(error) }));
        }
      }
    },
  };
}

/** Reads (without verifying) the caller's JWT claims so logs show who called. */
function callerClaims(req: Request): Fields {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { has_authorization: false };
  try {
    const part = token.split('.')[1];
    if (!part) return { has_authorization: true, caller_token_type: 'opaque' };
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return {
      has_authorization: true,
      caller_role: json.role ?? null,
      caller_user_id: json.sub ?? null,
      caller_token_expired: typeof json.exp === 'number' ? json.exp * 1000 < Date.now() : null,
      caller_session_id: json.session_id ?? null,
    };
  } catch {
    return { has_authorization: true, caller_token_type: 'unparseable' };
  }
}

type Handler = (req: Request, log: FnLogger) => Response | Promise<Response>;

/**
 * Wraps a Deno.serve handler: logs request_start / request_end (status, duration),
 * turns uncaught exceptions into a logged 500, and ships logs after the response
 * (EdgeRuntime.waitUntil when available, otherwise before returning).
 */
export function withLogging(fn: string, handler: Handler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const requestId = req.headers.get('sb-request-id') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
    const log = createFnLogger(fn, requestId);
    const started = performance.now();
    const url = new URL(req.url);
    const caller = callerClaims(req);
    log.bind({ caller_user_id: caller.caller_user_id ?? undefined, caller_role: caller.caller_role ?? undefined });
    log.info('request_start', {
      method: req.method,
      path: url.pathname,
      query_keys: [...url.searchParams.keys()],
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
      client_info: req.headers.get('x-client-info') ?? null,
      ...caller,
    });

    let response: Response;
    try {
      response = await handler(req, log);
      const status = response.status;
      log[status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info']('request_end', { status, duration_ms: Math.round(performance.now() - started) });
    } catch (error) {
      log.error('request_unhandled_error', { error, duration_ms: Math.round(performance.now() - started) });
      response = new Response(JSON.stringify({ error: 'internal_error', request_id: requestId }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const shipping = log.flush();
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(shipping);
    else await shipping;
    return response;
  };
}
