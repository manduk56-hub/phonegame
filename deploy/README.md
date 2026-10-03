# Ubuntu 원격 서버

## Git 연동 배포

권장 배포는 [Git 연동 배포](GIT-DEPLOY.md)입니다. `main`에 push하면 GitHub Actions가 테스트하고 서버가 해당 커밋을 받아 반영합니다. 최초 서버 연결과 GitHub 설정을 한 번 완료하면 배포 때마다 비밀번호를 입력할 필요가 없습니다. 아래 압축파일·비밀번호 방식은 기존 수동 배포 설명입니다.

현재 배포 주소: https://dirt-rally.115.68.208.145.sslip.io

앱은 `/opt/dirt-rally`에 있으며 `dirt-rally` 전용 계정으로 실행합니다. Node는 `127.0.0.1:3010`에서만 수신하고 Nginx가 외부 80/443 연결을 담당합니다. 기존 다른 서비스의 설정 파일은 수정하지 않습니다.

서버 설정은 `/etc/dirt-rally/server.env`에 있습니다. `HOST=127.0.0.1`, `PORT=3010`, `PUBLIC_URL=https://dirt-rally.115.68.208.145.sslip.io`, `HOST_KEY=<진행자 키>`를 사용합니다. 이 파일과 `/etc/dirt-rally/host-key`는 root만 읽을 수 있습니다. 키를 로그나 터미널 출력으로 공유하지 마세요.

## 관리

SSH 접속 후:

```sh
systemctl status dirt-rally
journalctl -u dirt-rally -n 50 --no-pager
systemctl restart dirt-rally
nginx -t
```

재시작하면 경기와 방 코드가 초기화됩니다. 앱 파일을 수정하는 동안 참가자가 없도록 하세요. 인증서 자동 갱신은 `certbot.timer`, 갱신 후 Nginx 재로드는 `/etc/letsencrypt/renewal-hooks/deploy/dirt-rally-nginx`가 담당합니다.

## 재배포

PC 프로젝트 폴더에서 필요한 파일만 묶습니다:

```powershell
tar -czf .runtime/dirt-rally-deploy.tgz server.mjs simulation.mjs package.json package-lock.json public game/arena.json deploy
```

SSH 접속에 사용하는 계정과 키로 묶음을 `/tmp/dirt-rally-deploy.tgz`에 전송한 뒤 Ubuntu에서:

```sh
tar -xzf /tmp/dirt-rally-deploy.tgz -C /opt/dirt-rally
bash /opt/dirt-rally/deploy/install-ubuntu.sh
```

설치 스크립트는 기존 진행자 키를 유지하며 npm 의존성을 설치하고 게임 서비스를 재시작합니다. Node.js 20 이상, Nginx, Certbot, Python 3와 root 권한을 전제로 합니다. 다른 서버에 사용할 때는 공개 주소, 포트와 배포 경로를 먼저 수정하세요.

최초 설정 시에는 HTTP ACME 경로로 인증서를 발급한 뒤 HTTPS 설정으로 전환합니다. sslip.io DNS, 외부 80/443 접근, 인증기관의 발급 제한에 따라 인증서 발급이 실패할 수 있습니다.

## 확인된 범위

2026-10-03 HTTPS `/config`의 관리 키 비노출, 실제 원격 WSS 연결 16개와 PC Godot의 조작·상태 수신·QR을 확인했습니다. 로컬 Node 테스트는 18개가 통과했고 Godot의 LAN 및 토큰 인증 대기실 검증도 통과했습니다. 실제 휴대폰 기종별 터치·인터넷 지연, 여러 독립 방, 재부팅 후 현장 운영은 별도 검증이 필요합니다.
