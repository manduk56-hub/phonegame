# Git 연동 배포

저장소: https://github.com/manduk56-hub/phonegame

로컬 파일을 개별 전송하는 대신 다음 순서로 반영합니다.

1. 수정한 내용을 `main`에 커밋하고 `git push`합니다.
2. GitHub Actions가 `npm ci`, `npm test`, 배포 스크립트 문법 검사를 실행합니다.
3. 테스트를 통과하면 전용 SSH 키로 서버에 해당 커밋의 배포만 요청합니다.
4. 서버가 Git 저장소에서 그 커밋을 받아 별도 폴더에서 다시 테스트합니다.
5. 검증된 화면 파일을 서비스에 반영합니다. 서버 코드나 의존성이 바뀌면 서버도 다시 시작합니다.

화면만 수정했으면 재시작하지 않으므로 방 코드와 경기를 유지합니다. 서버 코드·의존성·맵 설정이 바뀌면 재시작으로 방 코드와 경기가 초기화됩니다. 테스트 실패 시 반영하지 않고, 반영 중 오류가 발생하면 백업으로 복구합니다. 최신 main보다 오래된 요청은 건너뜁니다.

## 최초 연결: 한 번만 필요

Git 연동도 서버의 접근 권한을 새로 만들지는 못합니다. SSH 비밀번호가 작동하지 않으면 서버 제공업체의 웹 콘솔에서 초기 설정을 진행해야 합니다. 이후 배포에는 비밀번호를 입력하지 않습니다.

전용 키 생성 예시(개인 키는 Git에 올리지 않습니다):

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE/.ssh/dirt-rally-actions-deploy"
```

GitHub Actions 무인 실행에는 암호문 없는 전용 키를 사용합니다. 키의 개인 부분은 GitHub Environment Secret에만 등록하고, 공개 부분 `.pub`는 서버에 등록합니다. 키를 이 게임 외 다른 서비스에 재사용하지 않습니다.

서버 웹 콘솔에서 저장소를 받아 다음 명령을 실행합니다. 기존 Node 게임 서비스가 설치된 Ubuntu 서버용이며 `git`, `rsync`, `curl`, `python3`, Node.js 20 이상과 `sudo`가 필요합니다.

```bash
git clone https://github.com/manduk56-hub/phonegame.git /tmp/phonegame-setup
cd /tmp/phonegame-setup
sudo bash deploy/setup-git-deploy.sh /path/to/actions-key.pub
```

비공개 저장소라면 서버에도 저장소 **읽기 전용 Deploy key**를 등록하고 저장소 주소를 `git@github.com:manduk56-hub/phonegame.git`로 지정합니다. 이는 GitHub Actions가 서버에 접속하는 키와 별도입니다. 서버에서 GitHub 호스트 키를 확인한 뒤 다음처럼 설치합니다.

```bash
sudo bash deploy/setup-git-deploy.sh /path/to/actions-key.pub git@github.com:manduk56-hub/phonegame.git
```

초기 설정은 기존 `/opt/dirt-rally` 게임을 바로 변경하지 않습니다. 첫 배포는 GitHub 설정을 끝내고 main에 push하거나 Actions에서 수동 실행해야 합니다.

## GitHub 설정

저장소 Settings → Environments → `production`에 다음 항목을 등록합니다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Variable | `DEPLOY_HOST` | `115.68.208.145` |
| Variable | `DEPLOY_USER` | `dirt-rally-deploy` |
| Secret | `DEPLOY_SSH_KEY` | 전용 SSH 개인 키 내용 |
| Secret | `DEPLOY_KNOWN_HOSTS` | 서버의 확인된 SSH 호스트 키 행 |

호스트 키는 서버 제공업체 콘솔에서 지문을 확인한 값으로 등록합니다. 배포 계정은 `deploy <커밋 SHA>`만 허용하며 임의 명령이나 포트 포워딩을 허용하지 않습니다. 서버의 진행자 키와 환경 파일은 `/etc/dirt-rally`에 유지되고 배포하거나 Git에 올리지 않습니다.

## 이후 사용

```powershell
git add <검토한 파일들>
git commit -m "Update mobile controller"
git push origin main
```

GitHub Actions의 `Test and deploy` 실행에서 테스트·배포 결과를 확인합니다. `production` 환경에 별도 승인 규칙을 설정하면 해당 규칙이 적용됩니다. `workflow_dispatch`는 main에서 실행하세요.

서버 설치 여부와 현재 적용된 커밋은 서버 콘솔에서 확인합니다.

```bash
cat /var/lib/dirt-rally/deployed-commit
systemctl status dirt-rally
```

현재 준비된 파일은 로컬 상태입니다. 서버 초기 설정과 GitHub Secrets 등록을 끝내기 전에는 자동 배포가 활성화되지 않습니다. 배포 스크립트를 변경하면 초기 설치 명령을 다시 실행해 서버에 설치된 스크립트도 갱신해야 합니다.
