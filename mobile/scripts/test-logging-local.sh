#!/usr/bin/env bash
# Local end-to-end test of the logging pipeline:
#   iOS Simulator app → local bb-log-bridge (:3100) → fake Loki (:3101) → .logtest/loki.jsonl
# Nothing is sent to logs.starterschool.com. Ctrl-C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
BRIDGE_YAML="../../k8-playground/bb-log-bridge/configmap.yaml"
OUT=".logtest"; mkdir -p "$OUT"; : > "$OUT/loki.jsonl"

# Extract bridge.js from the ConfigMap (strip the 4-space YAML indent).
node -e '
const s=require("fs").readFileSync(process.argv[1],"utf8").split("bridge.js: |\n")[1];
require("fs").writeFileSync(process.argv[2], s.split("\n").map(l=>l.slice(4)).join("\n"));
' "$BRIDGE_YAML" "$OUT/bridge.js"

cat > "$OUT/fake-loki.js" <<'JS'
const fs=require('fs');
require('http').createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{
  try{for(const st of JSON.parse(b).streams)for(const [ts,line] of st.values)
    fs.appendFileSync(process.argv[2],JSON.stringify({labels:st.stream,ts,line:JSON.parse(line)})+'\n');}catch(e){console.error(e)}
  r.writeHead(204).end();});}).listen(3101,()=>console.log('fake loki on :3101'));
JS

export TEST_SECRET="local-test-$(date +%s)"
node "$OUT/fake-loki.js" "$OUT/loki.jsonl" & LOKI=$!
STAGING_SECRET=bb-unused PROD_SECRET=bb-unused PMCD_STAGING_SECRET="$TEST_SECRET" PMCD_PROD_SECRET="$TEST_SECRET" \
  LOKI_URL=http://127.0.0.1:3101 PORT=3100 node "$OUT/bridge.js" & BRIDGE=$!
trap 'kill $LOKI $BRIDGE 2>/dev/null' EXIT
sleep 1

# Expo SDK 57 dev builds inline env vars as {...process.env, ...dotenv files}, so .env.local
# beats the shell. `.env.development.local` has the highest precedence of all, so write the
# local-bridge values there for the duration of the run (gitignored via .env*.local).
OVERRIDE=".env.development.local"
if [ -e "$OVERRIDE" ]; then echo "Refusing to overwrite existing $OVERRIDE" >&2; exit 1; fi
cat > "$OVERRIDE" <<EOF
# Written by scripts/test-logging-local.sh — deleted when it exits. Points the app at the local bridge.
EXPO_PUBLIC_LOG_BRIDGE_URL=http://localhost:3100/v1/logs
EXPO_PUBLIC_LOG_BRIDGE_SECRET_STAGING=$TEST_SECRET
EXPO_PUBLIC_LOG_BRIDGE_SECRET_PRODUCTION=$TEST_SECRET
EOF
trap 'rm -f "$OVERRIDE"; kill $LOKI $BRIDGE 2>/dev/null' EXIT
echo "Captured logs → $(pwd)/$OUT/loki.jsonl"
# Needs Node ≥ 20.19 (Expo 57 uses util.parseEnv). Pass `--port 8082` if Docker holds 8081.
# Already built once? `npx expo start --port 8082` + `xcrun simctl launch booted <bundle id>` is faster.
npx expo run:ios "$@"
