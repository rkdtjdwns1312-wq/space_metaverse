#!/usr/bin/env bash
set -euo pipefail
systemctl is-active --quiet woozooclass.service
# Type=simple reports active before Node has opened its HTTP listener.
# Wait at most about 35 seconds (30-second retry window + final 5-second request).
health_json=$(curl --retry 15 --retry-connrefused --retry-delay 1 --retry-max-time 30 --connect-timeout 5 --max-time 5 --fail --silent --show-error http://127.0.0.1:3000/health)
printf '%s' "$health_json" |
  /usr/local/bin/node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;const v=JSON.parse(s);if(!v.ok||!v.persistent||v.publicOrigin!=="https://woozooclass.kr")process.exit(1);console.log("Local persistent health: OK");if(!v.crafting?.ready)console.warn("WARNING: private crafting recipes unavailable; check CRAFTING_RECIPES_FILE. Public recipes remain available.");else console.log("Private crafting recipe count: "+v.crafting.privateRecipeCount);'
for path in /.env /data/classes/ /deploy/ /server/index.js; do
  status=$(curl --connect-timeout 5 --max-time 15 --silent --show-error --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:3000$path")
  [[ "$status" == 404 ]] || { printf '%s\n' "Unexpected private-path status: $status" >&2; exit 1; }
done
printf '%s\n' 'Private HTTP paths: blocked'
if [[ "${1:-}" == --public ]]; then
  curl --connect-timeout 5 --max-time 15 --fail --silent --show-error https://woozooclass.kr/health >/dev/null
  curl --connect-timeout 5 --max-time 15 --fail --silent --show-error -H 'Origin: https://woozooclass.kr' 'https://woozooclass.kr/socket.io/?EIO=4&transport=polling' |
    /usr/local/bin/node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;if(!s.startsWith("0"))process.exit(1);const v=JSON.parse(s.slice(1));if(!v.sid||!v.upgrades.includes("websocket"))process.exit(1);console.log("Public TLS and Socket.IO handshake: OK");'
fi
