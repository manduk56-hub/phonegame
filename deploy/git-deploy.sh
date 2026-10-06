#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run via the deployment gateway.' >&2; exit 1; }
commit=${1:-}
[[ $commit =~ ^[0-9a-f]{40}$ ]] || { echo 'A Git commit SHA is required.' >&2; exit 2; }
repo=/var/lib/dirt-rally/git-source
app=/opt/dirt-rally
state=/var/lib/dirt-rally/deployed-commit
exec 9>/var/lock/dirt-rally-deploy.lock
flock 9
test -d "$repo/.git"
test -f "$app/server.mjs"
git -C "$repo" fetch --no-tags origin main
tip=$(git -C "$repo" rev-parse FETCH_HEAD)
if [[ $commit != "$tip" ]]; then
  echo 'Superseded commit: the next main deployment will apply the latest version.'
  exit 0
fi
if [[ -f $state && $(cat "$state") == "$commit" ]]; then
  echo "Already deployed $commit"
  exit 0
fi
stage=$(mktemp -d /var/lib/dirt-rally/deploy-stage.XXXXXX)
trap 'rm -rf -- "$stage"' EXIT
git -C "$repo" archive "$commit" | tar -x -C "$stage"
runtime_files=(server.mjs simulation.mjs collision.mjs waterway.mjs racing.mjs race-director.mjs fps.mjs package.json package-lock.json game/arena.json game/fps-arena.json game/fps-art.json game/circuit.json game/circuits.json game/car-shapes.json)
for file in "${runtime_files[@]}"; do
  test -f "$stage/$file"
done
test -d "$stage/public"
chown -R dirt-rally:dirt-rally "$stage"
# Repository lifecycle scripts and tests run as the game account, not root.
runuser -u dirt-rally -- bash -euc 'cd "$1"; npm ci --no-audit --no-fund; npm test' -- "$stage"
backend_changed=false
for file in "${runtime_files[@]}"; do
  cmp -s "$stage/$file" "$app/$file" || backend_changed=true
done
backup=/var/lib/dirt-rally/backups/$(date +%Y%m%d-%H%M%S)-${commit:0:12}
install -d -m 700 "$backup"
backup_files=(public)
new_files=()
for file in "${runtime_files[@]}"; do
  if [[ -f $app/$file ]]; then backup_files+=("$file"); else new_files+=("$file"); fi
done
tar -czf "$backup/runtime.tgz" -C "$app" "${backup_files[@]}"
stopped=false
updated=false
rollback() {
  local code=$?
  trap - ERR
  if [[ $stopped == true ]]; then systemctl stop dirt-rally; fi
  if [[ $updated == true ]]; then
    tar -xzf "$backup/runtime.tgz" -C "$app"
    for file in "${new_files[@]}"; do rm -f -- "$app/$file"; done
    if [[ -d $backup/node_modules ]]; then
      rm -rf -- "$app/node_modules"
      mv "$backup/node_modules" "$app/node_modules"
    fi
  fi
  if [[ $stopped == true ]]; then systemctl start dirt-rally; fi
  echo "Deployment failed; previous runtime restored from $backup" >&2
  exit "$code"
}
trap rollback ERR
if [[ $backend_changed == true ]]; then
  systemctl stop dirt-rally
  stopped=true
fi
updated=true
rsync -a --delete --chown=dirt-rally:dirt-rally "$stage/public/" "$app/public/"
if [[ $backend_changed == true ]]; then
  for file in "${runtime_files[@]}"; do
    install -o dirt-rally -g dirt-rally -m 644 "$stage/$file" "$app/$file"
  done
  if [[ -d $app/node_modules ]]; then mv "$app/node_modules" "$backup/node_modules"; fi
  mv "$stage/node_modules" "$app/node_modules"
  systemctl start dirt-rally
fi
curl --fail --silent --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3010/config |
  python3 -c 'import json,sys; c=json.load(sys.stdin); assert c["app"]=="dirt-rally" and c["adminKey"] is None and c["hostAuth"]=="token"'
printf '%s\n' "$commit" > "$state"
trap - ERR
echo "Deployed $commit; backend restart: $backend_changed"
