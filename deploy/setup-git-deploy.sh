#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run from the server console with sudo.' >&2; exit 1; }
public_key_file=${1:?Usage: sudo bash deploy/setup-git-deploy.sh /path/to/actions-key.pub [repository-url]}
repo_url=${2:-https://github.com/manduk56-hub/phonegame.git}
test -f "$public_key_file"
public_key=$(cat "$public_key_file")
[[ $public_key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ && $public_key != *$'\n'* ]] || { echo 'Provide one Ed25519 public key.' >&2; exit 2; }
for program in git node npm rsync curl python3 flock runuser; do command -v "$program" >/dev/null; done
id dirt-rally >/dev/null
test -d /opt/dirt-rally/public
repo=/var/lib/dirt-rally/git-source
if [[ ! -d $repo/.git ]]; then
  git clone --no-checkout "$repo_url" "$repo"
else
  [[ $(git -C "$repo" remote get-url origin) == "$repo_url" ]] || { echo 'Existing repository URL differs.' >&2; exit 1; }
fi
id dirt-rally-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash dirt-rally-deploy
install -d -m 755 /usr/local/lib/dirt-rally
install -m 755 "$(dirname "$0")/git-deploy.sh" /usr/local/lib/dirt-rally/git-deploy.sh
install -m 755 "$(dirname "$0")/git-deploy-gateway.sh" /usr/local/lib/dirt-rally/git-deploy-gateway.sh
install -d -o dirt-rally-deploy -g dirt-rally-deploy -m 700 /home/dirt-rally-deploy/.ssh
key_line="command=\"sudo -n /usr/local/lib/dirt-rally/git-deploy-gateway.sh\",restrict $public_key"
authorized=/home/dirt-rally-deploy/.ssh/authorized_keys
touch "$authorized"
grep -qxF "$key_line" "$authorized" || printf '%s\n' "$key_line" >> "$authorized"
chown dirt-rally-deploy:dirt-rally-deploy "$authorized"
chmod 600 "$authorized"
printf 'Defaults:dirt-rally-deploy env_keep += "SSH_ORIGINAL_COMMAND"\ndirt-rally-deploy ALL=(root) NOPASSWD: /usr/local/lib/dirt-rally/git-deploy-gateway.sh ""\n' > /etc/sudoers.d/dirt-rally-deploy
chmod 440 /etc/sudoers.d/dirt-rally-deploy
visudo -cf /etc/sudoers.d/dirt-rally-deploy
echo 'Ready: GitHub production environment DEPLOY_USER=dirt-rally-deploy.'
echo 'Configure DEPLOY_HOST, DEPLOY_SSH_KEY and verified DEPLOY_KNOWN_HOSTS in GitHub.'
