#!/usr/bin/env bash
set -euo pipefail
cd /opt/dirt-rally
id dirt-rally >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/dirt-rally --shell /usr/sbin/nologin dirt-rally
install -d -m 700 /etc/dirt-rally
if [ ! -f /etc/dirt-rally/server.env ]; then
    python3 - <<'PY'
import os, secrets
key = secrets.token_hex(32)
for name, body in [('host-key', key + '\n'), ('server.env', 'HOST=127.0.0.1\nPORT=3010\nPUBLIC_URL=https://dirt-rally.115.68.208.145.sslip.io\nHOST_KEY=' + key + '\n')]:
    with os.fdopen(os.open('/etc/dirt-rally/' + name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as f:
        f.write(body)
PY
fi
chown -R dirt-rally:dirt-rally /opt/dirt-rally
runuser -u dirt-rally -- npm ci --omit=dev --no-audit --no-fund
install -m 644 deploy/dirt-rally.service /etc/systemd/system/dirt-rally.service
systemctl daemon-reload
systemctl enable --now dirt-rally
systemctl restart dirt-rally
curl --fail --silent --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:3010/config | python3 -c 'import json,sys; c=json.load(sys.stdin); assert c["hostAuth"]=="token" and c["adminKey"] is None; print("Token-auth server ready")'
install -d /var/lib/letsencrypt
if [ ! -f /etc/letsencrypt/live/dirt-rally.115.68.208.145.sslip.io/fullchain.pem ]; then
    install -m 644 deploy/nginx-http.conf /etc/nginx/sites-available/dirt-rally
    ln -sfn /etc/nginx/sites-available/dirt-rally /etc/nginx/sites-enabled/dirt-rally
    nginx -t
    systemctl reload nginx
    certbot certonly --webroot -w /var/lib/letsencrypt -d dirt-rally.115.68.208.145.sslip.io --non-interactive --agree-tos --register-unsafely-without-email
fi
install -m 644 deploy/nginx.conf /etc/nginx/sites-available/dirt-rally
ln -sfn /etc/nginx/sites-available/dirt-rally /etc/nginx/sites-enabled/dirt-rally
nginx -t
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
install -m 755 deploy/renew-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/dirt-rally-nginx
systemctl restart dirt-rally
echo 'Deployment ready: https://dirt-rally.115.68.208.145.sslip.io'
