#!/usr/bin/env bash
set -euo pipefail
# The deployment key can request a commit, not an arbitrary server command.
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec /usr/local/lib/dirt-rally/git-deploy.sh "${BASH_REMATCH[1]}"
fi
echo 'Only deploy <40-character Git commit> is accepted.' >&2
exit 2
