# Logging → Grafana (Loki)

Same pipeline as BookBuds: clients and edge functions POST batched JSON logs to
`bb-log-bridge` (`https://logs.starterschool.com/v1/logs`, source in
`k8-playground/bb-log-bridge`), which pushes them to Loki. All lines carry `app="plan-my-c-day"`.

| Source | Code | Labels |
|---|---|---|
| iPhone / Android app | `src/lib/logger.ts` | `platform="ios"/"android"`, `logger=<area>` |
| Supabase edge functions | `supabase/functions/_shared/logger.ts` | `platform="edge"`, `logger=<function name>` |

Debug builds ship as `env="staging"` / `build="debug"`; release/TestFlight builds as
`env="production"` / `build="prod"`. Debug-level entries are dropped in production.

## Deploy

1. **Bridge** (k8-playground): add the two Plan-My-C-Day secrets, then apply the updated bridge.
   ```bash
   source <(grep LOG_BRIDGE_SECRET mobile/.env.local)
   kubectl patch secret bb-log-bridge-secrets --type merge -p \
     "{\"stringData\":{\"PMCD_STAGING_SECRET\":\"$EXPO_PUBLIC_LOG_BRIDGE_SECRET_STAGING\",\"PMCD_PROD_SECRET\":\"$EXPO_PUBLIC_LOG_BRIDGE_SECRET_PRODUCTION\"}}"
   kubectl apply -f bb-log-bridge/configmap.yaml -f bb-log-bridge/deployment.yaml
   ```
   BookBuds payloads (no `app` field) keep working unchanged.
2. **Edge functions**:
   ```bash
   supabase secrets set LOG_BRIDGE_SECRET=$EXPO_PUBLIC_LOG_BRIDGE_SECRET_PRODUCTION LOG_ENV=production
   supabase functions deploy recipe-moderation-email
   ```
3. **App**: the `EXPO_PUBLIC_LOG_BRIDGE_*` values live in `.env.local` (gitignored) and are
   inlined at build time. Restart Metro after changing them. No native changes or new
   dependencies — a normal JS update/rebuild is enough.

New edge functions: wrap the handler with `withLogging('<name>', async (req, log) => …)`.

## App behaviour (App Review limits)

- Queue mirrored to AsyncStorage so offline logs survive restarts; uploaded in batches of
  100 when online. Hard caps: 1,000 entries, 512 KB on disk, 300 entries/minute. Oldest
  entries are dropped first and a `log_queue_overflow` / `log_rate_limited` entry records it.
- Uploads only while the app is running (30 s timer, foreground, one batch on background,
  and right after any successful Supabase request). No background tasks or fetch.
- Redacted: password/token/secret/OTP/DOB/phone keys, JWTs, URL tokens. Emails are logged
  masked (`n***a@gmail.com`).
- App Store privacy label: this adds "Diagnostics → Other diagnostic data", linked to the user
  (user id), used for App Functionality. No tracking.

## Auth logging

On for every user and every device. No per-user flags, no sampling; all auth logs are info/warn/error, so release builds keep all of them.


| `logger` | What it covers |
|---|---|
| `auth` | Every auth event (`auth_event_*`), `auth_signed_out_unexpectedly` when the SDK drops a session we didn't ask to drop |
| `auth_http` | Every `/auth/v1` request: path, grant_type, status, duration, Supabase `error_code` |
| `gotrue` | Filtered auth-js internals: session load/refresh/save/remove, refresh failures (toggle: `EXPO_PUBLIC_AUTH_DEBUG_LOGS=false`) |
| `session_storage` | Keychain session reads/writes: chunk counts, missing chunks, corrupt manifests, timings |
| `auth_ui` | Sign-in / sign-up / reset / resend: step changes, validation reason codes, outcomes, error codes |
| `auth_link` | Email links (confirm / reset): which params arrived, why a link was ignored, each verification stage |
| `auth_me` | Me screen session restore, auto-refresh start/stop, sign-out |
| `auth_consumer` | Screens whose `getSession()` failed |
| `app` | Launch, foreground/background, uncaught JS errors |

## Field names worth knowing

- `msg` is the **event name** (`auth_request_failed`, `session_lookup_failed`, …), stable and grep-able.
- The human-readable text is **not** in a `message` field. A thrown error is logged as `error: {name, message,
  stack, code?, status?}`; Loki's `| json` flattens that to `error_name`, `error_message`, `error_stack`.
  Supabase HTTP failures carry a top-level `error_message` (plus `error_code`, `request_id`). A few lines carry
  a plain-string `error` or an `error_description`. The dashboard's Errors tables coalesce these with
  `label_format message="{{ or .error_message .error .error_description .msg }}"`.

## Local end-to-end test

```bash
cd mobile && ./scripts/test-logging-local.sh --port 8082   # Node ≥ 20.19
```
Runs the bridge (`:3100`) and a fake Loki (`:3101`), writes `.env.development.local` so the dev build
posts to the local bridge (Expo 57 inlines dotenv files over shell env), builds and launches the
Simulator app, and appends every received line to `.logtest/loki.jsonl`. The checklist of expected
lines is in `docs/logging-handoff.md`. Each entry carries the `session_id` of the launch it was logged
in, even when it was uploaded after a restart.

## Dashboard

**Plan My C-Day — Logs** in Grafana, folder *starterschool*:
https://ovh.grafana.starterschool.com/d/pmcd-logs — overview counters (errors, warnings, auth API failures,
email delivery failures, unexpected sign-outs, launches), an **Errors** row (one table row per error line: event = `msg`,
message = the human text coalesced from `error.message` / `error_message` / `error` / `error_description`,
error type, status, ids, stack; plus counts by logger + event + message), auth request/outcome panels keyed on `request_id`,
client-health panels (log pipeline, session storage, per-device volume), edge-function panels, and a
filtered log explorer (env / platform / logger / level / free text / user id). The dashboard is editable in
the UI; the generated source of truth is
`k8-playground/observability/grafana-dashboards/plan-my-c-day-logs.dashboard.json` — re-create with
`POST /api/dashboards/db` (`folderUid` of *starterschool*, `overwrite: true`) after editing the JSON, or
export from the UI back into that file.

## Alerts worth adding first

Grafana → Alert rules, Loki datasource, evaluate every 1 m:

```logql
# Any Auth API 5xx seen by the app (e.g. GoTrue "Error sending confirmation email" when SMTP is broken)
sum(count_over_time({app="plan-my-c-day", logger="auth_http", level="error"}[5m])) > 0

# Sign-up / reset / resend that failed because our side could not send the email
sum(count_over_time({app="plan-my-c-day", logger="auth_ui"} |= "email_delivery_failed" [5m])) > 0

# Unexpected sign-outs
sum(count_over_time({app="plan-my-c-day", logger="auth"} |= "auth_signed_out_unexpectedly" [15m])) > 0
```

## Useful queries

```logql
# Everything for one user (find the id from any auth_event line)
{app="plan-my-c-day"} | json | user_id="<uuid>"

# Auth health across ALL users: failures and unexpected sign-outs per hour
sum by (msg) (count_over_time({app="plan-my-c-day", logger=~"auth.*|gotrue|session_storage", level=~"warn|error"} | json [1h]))

# How many distinct users hit an auth problem in the last day
count(sum by (user_id) (count_over_time({app="plan-my-c-day", logger=~"auth.*|gotrue|session_storage", level=~"warn|error"} | json | user_id!="" [24h])))

# Drill into one user's auth story (includes their pre-login attempts once they sign in)
{app="plan-my-c-day", logger=~"auth.*|gotrue|session_storage"} | json | user_id="<uuid>"

# Unexpected sign-outs and failed refreshes across all users
{app="plan-my-c-day"} |~ "auth_signed_out_unexpectedly|refresh_token|session_chunks_missing|session_read_failed"

# Auth API failures by error code
sum by (error_code) (count_over_time({app="plan-my-c-day", logger="auth_http"} | json | msg="auth_request_failed" [24h]))

# Email links that were ignored (wrong scheme, PKCE code, unsupported type)
{app="plan-my-c-day", logger="auth_link"} | json | msg="auth_link_ignored"

# Edge function errors
{app="plan-my-c-day", platform="edge", level=~"warn|error"}
```
