#!/usr/bin/env bash
# Run only from the private operating server console with a reviewed, pushed commit SHA.
set -euo pipefail

sha="${1:-}"
if [[ "$(id -u)" != 0 || ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Usage: root shell: update-from-github.sh <40-character commit SHA>' >&2
  exit 2
fi

base=/opt/woozooclass
old="$(readlink -f "$base/current")"
new="$base/releases/$sha"
[[ -f "$old/server/index.js" && ! -e "$new" ]] || { echo 'Current release missing or target already exists.' >&2; exit 1; }

archive="$(mktemp /root/woozooclass-release.XXXXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT
curl -fSL --retry 3 --connect-timeout 15 --max-time 600 \
  "https://github.com/rkdtjdwns1312-wq/space_metaverse/archive/$sha.tar.gz" -o "$archive"
tar -tzf "$archive" >/dev/null
install -d -m 0755 -o root -g root "$new"
tar --no-same-owner --strip-components=1 -xzf "$archive" -C "$new"
[[ -f "$new/server/index.js" && -f "$new/pnpm-lock.yaml" && ! -e "$new/.env" && ! -e "$new/data" && ! -e "$new/.local" ]]
(
  cd "$new"
  CI=1 pnpm install --prod --frozen-lockfile --ignore-scripts
)
chown -R root:root "$new"
chmod -R go-w "$new"

# The backup service saves operating config and classroom data together.
systemctl start woozooclass-backup.service
switched=0
rollback(){
  if (( switched )); then
    trap - ERR
    ln -s "$old" "$base/.current-rollback-$sha"
    mv -Tf "$base/.current-rollback-$sha" "$base/current"
    systemctl restart woozooclass.service
    echo "Deployment failed; restored $(basename "$old")." >&2
  fi
}
trap rollback ERR
ln -s "$new" "$base/.current-next-$sha"
mv -Tf "$base/.current-next-$sha" "$base/current"
switched=1
systemctl restart woozooclass.service
bash "$new/deploy/check-host.sh" --public
[[ "$(readlink -f "$base/current")" == "$new" ]]
switched=0
trap - ERR
echo "Operating release: $sha"
