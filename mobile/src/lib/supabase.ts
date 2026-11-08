import 'react-native-url-polyfill/auto';
import { sessionStorage } from './session-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { createLogger, elapsed, maskEmail, notifyNetworkUp, setLogUser, startLogging } from './logger';

startLogging();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Add your Supabase URL and publishable key to .env.local, then restart Expo.');
}

const authLog = createLogger('auth');
const httpLog = createLogger('auth_http');
const apiLog = createLogger('api');
const gotrueLog = createLogger('gotrue');

// ── Network instrumentation ───────────────────────────────────────────────────
// Every Auth API call is logged (path, status, timing, Supabase error code) so failed
// refreshes / sign-ins show up in Grafana. Data API calls are only logged when they fail.
// Request/response bodies are never logged, only the error code + message from failures.
function describe(input: RequestInfo | URL): { path: string; query: string } {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(raw);
    const grant = parsed.searchParams.get('grant_type');
    const type = parsed.searchParams.get('type');
    return { path: parsed.pathname, query: [grant && `grant_type=${grant}`, type && `type=${type}`].filter(Boolean).join('&') };
  } catch {
    return { path: 'unparseable', query: '' };
  }
}

async function errorBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const text = await response.clone().text();
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      return {
        error_code: json.error_code ?? json.code ?? json.error ?? null,
        error_message: json.msg ?? json.message ?? json.error_description ?? null,
        details: json.details ?? null,
        hint: json.hint ?? null,
      };
    } catch {
      return { body_prefix: text.slice(0, 300) };
    }
  } catch {
    return {};
  }
}

const instrumentedFetch: typeof fetch = async (input, init) => {
  const { path, query } = describe(input);
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const isAuth = path.startsWith('/auth/v1');
  const started = Date.now();
  try {
    const response = await fetch(input, init);
    const fields = { method, path, query: query || undefined, status: response.status, duration_ms: elapsed(started) };
    if (response.ok) {
      notifyNetworkUp();
      if (isAuth) httpLog.info('auth_request_ok', fields);
    } else {
      notifyNetworkUp();
      const body = await errorBody(response);
      if (isAuth) httpLog[response.status >= 500 ? 'error' : 'warn']('auth_request_failed', { ...fields, ...body, request_id: response.headers.get('sb-request-id') ?? response.headers.get('x-request-id') ?? undefined });
      else apiLog[response.status >= 500 ? 'error' : 'warn']('api_request_failed', { ...fields, ...body });
    }
    return response;
  } catch (error) {
    const fields = { method, path, query: query || undefined, duration_ms: elapsed(started), error };
    if (isAuth) httpLog.error('auth_request_network_error', fields);
    else apiLog.warn('api_request_network_error', fields);
    throw error;
  }
};

// ── GoTrue internal debug stream ──────────────────────────────────────────────
// auth-js narrates its session lifecycle (load from storage, refresh, save, remove) through
// `debug`. We keep the lines that explain why a session was refreshed, kept or dropped and
// skip the high-volume lock/tick chatter.
const AUTH_DEBUG = process.env.EXPO_PUBLIC_AUTH_DEBUG_LOGS !== 'false';
const KEEP_METHOD = /refresh|recoverAndRefresh|saveSession|removeSession|notifyAllSubscribers|_initialize|exchangeCode|startAutoRefresh|stopAutoRefresh|INITIAL_SESSION|signOut/i;
const SKIP_METHOD = /autoRefreshTokenTick|acquireLock|_useSession|__loadSession|#getSession|onAuthStateChange|unsubscribe/i;
const INTERESTING = /error|fail|expired|not valid|invalid|discard|preserv|skipping|not available|missing|abort/i;

function summarize(arg: unknown): unknown {
  if (arg && typeof arg === 'object' && 'access_token' in arg && 'user' in (arg as object)) {
    const session = arg as Session;
    return { session_user_id: session.user?.id, expires_at: session.expires_at, expires_in_s: session.expires_at ? session.expires_at - Math.floor(Date.now() / 1000) : null };
  }
  return arg;
}

function gotrueDebug(_prefix: string, ...args: unknown[]) {
  const method = typeof args[0] === 'string' ? args[0] : '';
  const text = args.filter(a => typeof a === 'string').join(' ');
  const keep = (KEEP_METHOD.test(method) && !SKIP_METHOD.test(method)) || INTERESTING.test(text);
  if (!keep) return;
  // Stop the noisy "begin/end" pairs from dominating unless they carry data.
  if (args.length === 2 && (args[1] === 'begin' || args[1] === 'end') && !/refresh|removeSession|saveSession/i.test(method)) return;
  const level = /error|fail/i.test(text) ? 'warn' : 'info';
  gotrueLog[level]('gotrue_debug', { method, detail: args.slice(1).map(summarize) });
}

// This client handles both authentication and database queries.
export const supabase = createClient(url, key, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: sessionStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    ...(AUTH_DEBUG ? { debug: gotrueDebug } : {}),
  },
  global: { fetch: instrumentedFetch },
});

// ── Auth state ────────────────────────────────────────────────────────────────
// One app-wide listener records every auth event and keeps the log identity in sync.
// SIGNED_OUT that we didn't ask for (see markIntentionalSignOut) is the classic
// "I got logged out" symptom, so it is logged as a warning with the last known state.
let lastSession: { userId: string; expiresAt: number | null; refreshedAt: number } | null = null;
let intentionalSignOutAt = 0;
export function markIntentionalSignOut(reason: string) {
  intentionalSignOutAt = Date.now();
  authLog.info('sign_out_requested', { reason });
}

supabase.auth.onAuthStateChange((event, session) => {
  const now = Date.now();
  const user = session?.user;
  const fields = {
    event,
    has_session: !!session,
    session_user_id: user?.id ?? null,
    expires_at: session?.expires_at ?? null,
    expires_in_s: session?.expires_at ? session.expires_at - Math.floor(now / 1000) : null,
    email: maskEmail(user?.email),
    email_confirmed: user ? !!user.email_confirmed_at : null,
    last_sign_in_at: user?.last_sign_in_at ?? null,
    aal: (session as { aal?: string } | null)?.aal ?? undefined,
    previous_user_id: lastSession?.userId ?? null,
    ms_since_previous_event: lastSession ? now - lastSession.refreshedAt : null,
  };
  if (user) setLogUser({ id: user.id, username: (user.user_metadata?.username as string | undefined) ?? null, firstName: (user.user_metadata?.first_name as string | undefined) ?? null });

  if (event === 'SIGNED_OUT') {
    const intentional = now - intentionalSignOutAt < 30_000;
    authLog[intentional ? 'info' : 'warn'](intentional ? 'auth_signed_out' : 'auth_signed_out_unexpectedly', {
      ...fields,
      previous_expires_at: lastSession?.expiresAt ?? null,
      previous_was_expired: lastSession?.expiresAt ? lastSession.expiresAt * 1000 < now : null,
    });
    // Ship the sign-out context before user identity is cleared.
    lastSession = null;
    setLogUser(null);
    return;
  }
  if (event === 'INITIAL_SESSION' && !session) authLog.info('auth_initial_session_empty', fields);
  else authLog.info(`auth_event_${event.toLowerCase()}`, fields);
  if (session && user) lastSession = { userId: user.id, expiresAt: session.expires_at ?? null, refreshedAt: now };
});
