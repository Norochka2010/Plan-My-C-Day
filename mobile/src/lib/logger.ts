/**
 * Structured client logging → bb-log-bridge → Loki (Grafana).
 *
 * Same wire format and bridge as BookBuds (`BbLogger.swift`), tagged `app="plan-my-c-day"`.
 * Query in Grafana:  {app="plan-my-c-day", platform="ios"} | json
 *
 * Offline behaviour
 * - Every entry goes into one ordered queue that is mirrored to AsyncStorage (debounced),
 *   so logs written while offline survive app kills and are uploaded in batches later.
 * - Upload runs on a 30 s timer, when 50+ entries are waiting, when the app returns to the
 *   foreground, and once when it leaves the foreground. Failures back off 15 s → 5 min.
 *   Any successful Supabase request (see supabase.ts) counts as "we're online again" and
 *   triggers an immediate retry.
 *
 * App Review / resource limits
 * - Hard caps: 1,000 queued entries and 512 KB on disk; the oldest entries are dropped first
 *   and a `log_queue_overflow` entry records how many were lost.
 * - At most 300 entries per minute are accepted; excess is counted, not stored.
 * - No background tasks, no background fetch, no wake-ups: uploads only happen while the app
 *   is already running.
 * - No secrets: password/token/OTP/DOB/phone keys are redacted, JWTs and URL tokens are
 *   scrubbed from strings. Do not pass raw emails; use `maskEmail()`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform, type AppStateStatus } from 'react-native';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogValue = null | boolean | number | string | LogValue[] | { [key: string]: LogValue };
export type LogFields = Record<string, unknown>;

type Entry = { seq: number; ts: number; level: LogLevel; logger: string; msg: string; fields: Record<string, LogValue> };
type StoredEntry = Omit<Entry, 'seq'>;

// ── Config ────────────────────────────────────────────────────────────────────
const APP = 'plan-my-c-day';
const ENV: 'staging' | 'production' = __DEV__ ? 'staging' : 'production';
const BRIDGE_URL = process.env.EXPO_PUBLIC_LOG_BRIDGE_URL || 'https://logs.starterschool.com/v1/logs';
// Write-only bearer for the bridge (no read access to Loki) — same posture as the Supabase publishable key.
const BRIDGE_SECRET = (__DEV__ ? process.env.EXPO_PUBLIC_LOG_BRIDGE_SECRET_STAGING : process.env.EXPO_PUBLIC_LOG_BRIDGE_SECRET_PRODUCTION) || '';
const SHIP_ENABLED = Platform.OS !== 'web' && !!BRIDGE_SECRET;
const PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

const MAX_QUEUE_ENTRIES = 1000;
const MAX_PERSIST_BYTES = 512 * 1024;
const MAX_FIELDS_BYTES = 8 * 1024;
const BATCH_SIZE = 100;
const WATERMARK = 50;
const FLUSH_INTERVAL_MS = 30_000;
const PERSIST_DEBOUNCE_MS = 1_500;
const REQUEST_TIMEOUT_MS = 10_000;
const BACKOFF_MIN_MS = 15_000;
const BACKOFF_MAX_MS = 5 * 60_000;
const RATE_LIMIT_PER_MINUTE = 300;
const QUEUE_KEY = 'pmcd.logs.queue.v1';
const DEVICE_KEY = 'pmcd.logs.device_id';

// ── Redaction ─────────────────────────────────────────────────────────────────
const SENSITIVE_KEYS = new Set([
  'password', 'confirm', 'new_password', 'old_password', 'token', 'access_token', 'refresh_token',
  'provider_token', 'provider_refresh_token', 'id_token', 'secret', 'authorization', 'apikey', 'api_key',
  'otp', 'code_verifier', 'nonce', 'date_of_birth', 'dob', 'birthday', 'phone', 'phone_number', 'cookie',
]);
const SENSITIVE_SUFFIX = /(_token|_secret|password)$/i;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const URL_SECRET = /\b(access_token|refresh_token|provider_token|token_hash|token|code)=([^&#\s"']+)/gi;
const BEARER = /\b(Bearer)\s+[\w.~+/-]+=*/gi;

export function scrub(text: string): string {
  return text.replace(JWT, '[jwt]').replace(URL_SECRET, '$1=[redacted]').replace(BEARER, '$1 [redacted]');
}

/** "jane.doe@gmail.com" → "j***e@gmail.com" — enough to correlate a user without storing the address. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!domain) return '[invalid]';
  const masked = local.length <= 2 ? `${local[0] ?? ''}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${masked}@${domain}`;
}

/** Normalises Error / AuthError / PostgrestError / unknown throwables into plain JSON. */
export function serializeError(error: unknown): Record<string, LogValue> {
  if (error === null || error === undefined) return { message: String(error) };
  if (typeof error !== 'object') return { message: scrub(String(error)).slice(0, 2000) };
  const e = error as Record<string, unknown> & { name?: unknown; message?: unknown; stack?: unknown };
  const out: Record<string, LogValue> = {};
  if (typeof e.name === 'string') out.name = e.name;
  out.message = typeof e.message === 'string' ? scrub(e.message).slice(0, 2000) : scrub(String(error)).slice(0, 2000);
  for (const k of ['code', 'status', 'error_code', 'details', 'hint', 'reasons', 'weak_password']) {
    const v = e[k];
    if (v !== undefined && v !== null) out[k] = sanitize(v, 2) as LogValue;
  }
  if (typeof e.stack === 'string') out.stack = scrub(e.stack).split('\n').slice(0, 12).join('\n');
  const cause = (e as { cause?: unknown }).cause;
  if (cause && cause !== error) out.cause = serializeError(cause);
  return out;
}

function sanitize(value: unknown, depth = 0): LogValue | undefined {
  if (value === null) return null;
  switch (typeof value) {
    case 'string': return scrub(value).slice(0, 2000);
    case 'number': return Number.isFinite(value) ? value : String(value);
    case 'boolean': return value;
    case 'bigint': return value.toString();
    case 'undefined': case 'function': case 'symbol': return undefined;
  }
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();
  if (depth >= 5) return '[depth]';
  if (Array.isArray(value)) {
    const arr = value.slice(0, 50).map(v => sanitize(v, depth + 1)).filter((v): v is LogValue => v !== undefined);
    if (value.length > 50) arr.push(`[+${value.length - 50} more]`);
    return arr;
  }
  const obj = value as Record<string, unknown>;
  // Supabase-style error objects that aren't Error instances.
  if (typeof obj.message === 'string' && ('code' in obj || 'status' in obj) && depth > 0) return serializeError(obj);
  const out: Record<string, LogValue> = {};
  for (const [k, v] of Object.entries(obj).slice(0, 50)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_SUFFIX.test(k)) { if (v !== undefined && v !== null && v !== '') out[k] = '[redacted]'; continue; }
    const clean = sanitize(v, depth + 1);
    if (clean !== undefined) out[k] = clean;
  }
  return out;
}

function cleanFields(fields: LogFields | undefined): Record<string, LogValue> {
  if (!fields) return {};
  const clean = (sanitize(fields, 0) ?? {}) as Record<string, LogValue>;
  const size = JSON.stringify(clean).length;
  if (size > MAX_FIELDS_BYTES) return { fields_truncated: true, fields_bytes: size, fields_preview: JSON.stringify(clean).slice(0, 4000) };
  return clean;
}

// ── State ─────────────────────────────────────────────────────────────────────
let queue: Entry[] = [];
let seq = 0;
let started = false;
let loaded = false;
let sending = false;
let droppedOverflow = 0;
let droppedRate = 0;
let rateWindowStart = Date.now();
let rateWindowCount = 0;
let backoffMs = 0;
let nextAttemptAt = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let appState: AppStateStatus = (AppState.currentState as AppStateStatus | null) ?? 'active';
let deviceId: string | null = null;
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const identity: { userId: string | null; username: string | null; firstName: string | null } = { userId: null, username: null, firstName: null };

const context: Record<string, string | number | boolean> = {
  os: Platform.OS,
  os_version: String(Device.osVersion ?? Platform.Version ?? ''),
  device_model: Device.modelName ?? 'unknown',
  is_device: Device.isDevice,
  execution_env: String(Constants.executionEnvironment ?? 'unknown'),
};

// ── Core ──────────────────────────────────────────────────────────────────────
function push(level: LogLevel, logger: string, msg: string, fields?: LogFields) {
  if (__DEV__) {
    const print = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (level !== 'debug' || logger !== 'gotrue') print(`[${logger}] ${msg}`, fields ? cleanFields(fields) : '');
  }
  if (level === 'debug' && ENV === 'production') return;

  const now = Date.now();
  if (now - rateWindowStart >= 60_000) {
    if (droppedRate > 0) {
      const lost = droppedRate; droppedRate = 0;
      append({ seq: seq++, ts: now, level: 'warn', logger: 'logger', msg: 'log_rate_limited', fields: { dropped_count: lost, limit_per_minute: RATE_LIMIT_PER_MINUTE } });
    }
    rateWindowStart = now; rateWindowCount = 0;
  }
  if (++rateWindowCount > RATE_LIMIT_PER_MINUTE) { droppedRate++; return; }

  append({ seq: seq++, ts: now, level, logger: logger.slice(0, 64), msg: msg.slice(0, 200), fields: cleanFields(fields) });
  if (queue.length >= WATERMARK) void flush('watermark');
}

function append(entry: Entry) {
  // Stamped per entry (not per upload) so entries restored from a previous launch keep the
  // session_id and app_state they were logged under instead of inheriting the new session's.
  entry.fields.session_id = sessionId;
  entry.fields.app_state = appState;
  queue.push(entry);
  if (queue.length > MAX_QUEUE_ENTRIES) {
    const over = queue.length - MAX_QUEUE_ENTRIES;
    queue.splice(0, over);
    droppedOverflow += over;
  }
  schedulePersist();
}

function schedulePersist() {
  if (!loaded || persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; void persistNow(); }, PERSIST_DEBOUNCE_MS);
}

async function persistNow() {
  if (!loaded) return;
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  try {
    if (queue.length === 0) { await AsyncStorage.removeItem(QUEUE_KEY); return; }
    // Keep the newest entries that fit under the byte cap.
    const lines: string[] = [];
    let bytes = 2;
    for (let i = queue.length - 1; i >= 0; i--) {
      const { seq: _seq, ...stored } = queue[i];
      const line = JSON.stringify(stored);
      if (bytes + line.length + 1 > MAX_PERSIST_BYTES) { droppedOverflow += i + 1; queue.splice(0, i + 1); break; }
      bytes += line.length + 1;
      lines.push(line);
    }
    await AsyncStorage.setItem(QUEUE_KEY, `[${lines.reverse().join(',')}]`);
  } catch (error) {
    if (__DEV__) console.warn('[logger] persist failed', error);
  }
}

async function loadPersisted() {
  try {
    const [raw, savedDevice] = await Promise.all([AsyncStorage.getItem(QUEUE_KEY), AsyncStorage.getItem(DEVICE_KEY)]);
    deviceId = savedDevice;
    if (!deviceId) {
      deviceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(DEVICE_KEY, deviceId).catch(() => {});
    }
    let restored: StoredEntry[] = [];
    if (raw) {
      try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) restored = parsed.filter(e => e && typeof e.msg === 'string'); }
      catch { await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {}); }
    }
    // Restored (older) entries go first, then anything logged during startup; renumber in order.
    const merged = [...restored, ...queue];
    queue = merged.slice(-MAX_QUEUE_ENTRIES).map((e, i) => ({ ...e, seq: i }));
    seq = queue.length;
    if (restored.length) push('info', 'logger', 'log_queue_restored', { restored_count: restored.length });
  } catch (error) {
    if (__DEV__) console.warn('[logger] load failed', error);
    deviceId = deviceId ?? 'unknown';
  } finally {
    loaded = true;
    schedulePersist();
  }
}

async function send(batch: Entry[]): Promise<'ok' | 'retry' | 'drop'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BRIDGE_SECRET}` },
      body: JSON.stringify({
        app: APP,
        env: ENV,
        platform: PLATFORM,
        app_version: Constants.expoConfig?.version ?? null,
        device_id: deviceId,
        user_id: identity.userId,
        username: identity.username,
        first_name: identity.firstName,
        context,
        entries: batch.map(({ seq: _s, ...e }) => e),
      }),
      signal: controller.signal,
    });
    if (res.ok) return 'ok';
    // A malformed or oversized batch will never succeed: drop it rather than retry forever.
    if (res.status === 400 || res.status === 413) return 'drop';
    return 'retry';
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

type FlushReason = 'timer' | 'watermark' | 'foreground' | 'background' | 'network_up' | 'manual';

async function flush(reason: FlushReason) {
  if (!SHIP_ENABLED || !started || !loaded || sending || queue.length === 0) return;
  const forced = reason === 'foreground' || reason === 'background' || reason === 'network_up' || reason === 'manual';
  if (!forced && Date.now() < nextAttemptAt) return;
  if (appState !== 'active' && reason !== 'background') return;
  sending = true;
  try {
    if (droppedOverflow > 0) {
      const lost = droppedOverflow; droppedOverflow = 0;
      append({ seq: seq++, ts: Date.now(), level: 'warn', logger: 'logger', msg: 'log_queue_overflow', fields: { dropped_count: lost, max_entries: MAX_QUEUE_ENTRIES, max_bytes: MAX_PERSIST_BYTES } });
    }
    // On background we get one short window: send at most one batch.
    const maxBatches = reason === 'background' ? 1 : 20;
    for (let i = 0; i < maxBatches && queue.length > 0; i++) {
      const batch = queue.slice(0, BATCH_SIZE);
      const result = await send(batch);
      if (result === 'retry') {
        backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs ? backoffMs * 2 : BACKOFF_MIN_MS);
        nextAttemptAt = Date.now() + backoffMs;
        break;
      }
      const lastSeq = batch[batch.length - 1].seq;
      queue = queue.filter(e => e.seq > lastSeq);
      backoffMs = 0; nextAttemptAt = 0;
    }
  } finally {
    sending = false;
    void persistNow();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
};

/** `const log = createLogger('auth'); log.warn('sign_in_failed', { error })` — msg is a snake_case event name. */
export function createLogger(name: string): Logger {
  return {
    debug: (msg, fields) => push('debug', name, msg, fields),
    info: (msg, fields) => push('info', name, msg, fields),
    warn: (msg, fields) => push('warn', name, msg, fields),
    error: (msg, fields) => push('error', name, msg, fields),
  };
}

/** Attach the signed-in user to every subsequent upload. Pass null on sign-out. */
export function setLogUser(user: { id: string; username?: string | null; firstName?: string | null } | null) {
  if (!user) { identity.userId = null; identity.username = null; identity.firstName = null; return; }
  if (identity.userId !== user.id) { identity.username = null; identity.firstName = null; }
  identity.userId = user.id;
  if (user.username !== undefined) identity.username = user.username;
  if (user.firstName !== undefined) identity.firstName = user.firstName;
}

/** Called by the Supabase fetch wrapper when a request succeeds: if uploads were backing off, retry now. */
export function notifyNetworkUp() {
  if (backoffMs > 0 && queue.length > 0) void flush('network_up');
}

export function flushLogs() { return flush('manual'); }

export const elapsed = (startedAt: number) => Date.now() - startedAt;

const lifecycle = createLogger('app');

/** Idempotent. Call once at app startup (root layout module scope). */
export function startLogging() {
  if (started) return;
  started = true;
  void loadPersisted().then(() => flush('foreground'));

  lifecycle.info('app_start', { ship_enabled: SHIP_ENABLED, env: ENV });

  AppState.addEventListener('change', next => {
    const previous = appState;
    appState = next;
    if (previous === next) return;
    lifecycle.info('app_state_change', { from: previous, to: next });
    if (next === 'active') {
      backoffMs = 0; nextAttemptAt = 0;
      void flush('foreground');
    } else if (previous === 'active') {
      void persistNow().then(() => flush('background'));
    }
  });

  flushTimer = setInterval(() => { void flush('timer'); }, FLUSH_INTERVAL_MS);

  // Record uncaught JS errors (including fatal ones) before React Native's default handler runs.
  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      try {
        lifecycle.error(isFatal ? 'js_fatal_error' : 'js_unhandled_error', { error, is_fatal: !!isFatal });
        void persistNow();
      } catch { /* never let logging break the crash path */ }
      previous(error, isFatal);
    });
  }
}

export function stopLoggingForTests() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  started = false;
}
