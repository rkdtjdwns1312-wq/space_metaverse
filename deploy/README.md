# Ubuntu 24.04 새 교실 배포

단일 서버에서 Caddy → `127.0.0.1:3000` → Node 앱을 실행한다. 이 파일들은 배포 준비물이며, 저장소에 존재하는 것만으로 서버·DNS·백업이 설정되지는 않는다. 기존 PC의 `.env`, `.local`, `data` 및 기존 교실은 옮기지 않는다.

| 위치 | 용도·권한 |
| --- | --- |
| `/opt/woozooclass/releases/<commit>` | 검증한 코드·운영 의존성, root 소유 |
| `/opt/woozooclass/current` | 현재 릴리스 심볼릭 링크 |
| `/etc/woozooclass/app.env` | 새 키·관리자 비밀번호, root 0600 |
| `/var/lib/woozooclass/classes` | 새 교실 자료, woozooclass 0700 |
| `/var/backups/woozooclass` | 설정·교실 자료의 로컬 백업, root 0700 |

Node 24 LTS, 프로젝트에 고정한 pnpm 11.19.0, Caddy, systemd가 필요하다. 2GB 서버에서의 동시 사용 성능은 별도 측정 대상이다. 초기 `MAX_ACTIVE_ROOMS=1`이며 학생 이용 시간은 한국 시간 07~22시다. 앱 계정은 로그인할 수 없는 전용 계정이고 앱 프로세스는 root로 실행하지 않는다.

## 1. 코드만 준비

작업 PC에서 검수·커밋 후 실행한다. 아래 묶음에는 실제 설정·학생 자료·Windows 의존성이 포함되지 않는다. 생성된 파일을 서버로 비공개 전송한다. 저장소가 비공개이면 인증 토큰을 URL·명령 기록에 적어 내려받지 않는다.

```sh
git archive --format=tar.gz --output=.local/woozooclass-release.tar.gz HEAD client shared server scripts deploy package.json pnpm-lock.yaml
git rev-parse HEAD
```

## 2. 서버 실행 환경 설치

Ubuntu 24.04의 root 콘솔에서 실행한다. 기존 Node·Caddy 설치가 있다면 경로와 버전을 먼저 확인하고 덮어쓰지 않는다. 다음은 새 서버의 x86-64 기준이다. 클라우드 방화벽의 송신 기본 정책도 확인한다. 패키지·인증서 설치에는 DNS 조회와 외부 HTTP/HTTPS 통신이 필요하다. 설치 블록은 오류가 나면 중단하고 원인을 해결한 뒤 이어 간다.

```sh
apt-get update
apt-get install -y ca-certificates curl xz-utils gnupg debian-keyring debian-archive-keyring apt-transport-https
test "$(uname -m)" = x86_64
node_stage=$(mktemp -d)
cd "$node_stage"
curl -fSLO https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.xz
curl -fSLO https://nodejs.org/dist/v24.22.1/SHASUMS256.txt
sha256sum --check --ignore-missing SHASUMS256.txt
tar -xJf node-v24.22.1-linux-x64.tar.xz -C /opt
ln -s /opt/node-v24.22.1-linux-x64/bin/node /usr/local/bin/node
ln -s /opt/node-v24.22.1-linux-x64/bin/npm /usr/local/bin/npm
npm install --global --prefix /usr/local pnpm@11.19.0
node --version
pnpm --version
```

Node 24.22.1은 2026-10-21 공식 LTS 보안 릴리스다. 이후 설치라면 지원되는 24 LTS의 보안 업데이트를 확인한다. 다운로드 체크섬은 공식 HTTPS 배포 목록과 대조하며 별도의 서명 검증을 했다는 뜻은 아니다.

[Caddy 공식 Ubuntu 설치](https://caddyserver.com/docs/install#debian-ubuntu-raspbian)에 따라 설치한다. 패키지 설치 때 기본 Caddy 서비스가 시작된다.

```sh
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

## 3. 새 코드·계정·설정 배치

`RELEASE_COMMIT`을 앞에서 확인한 실제 SHA로, 업로드 파일 경로를 실제 경로로 바꾼다. `/opt/woozooclass/current` 또는 `app.env`가 이미 있으면 신규 절차를 반복하지 않고 아래 업데이트 절차를 사용한다.

```sh
useradd --system --user-group --home-dir /var/lib/woozooclass --shell /usr/sbin/nologin woozooclass
install -d -m 0755 -o root -g root /opt/woozooclass/releases/RELEASE_COMMIT
tar --no-same-owner -xzf /root/woozooclass-release.tar.gz -C /opt/woozooclass/releases/RELEASE_COMMIT
cd /opt/woozooclass/releases/RELEASE_COMMIT
test ! -e .env && test ! -e data && test ! -e .local
pnpm install --prod --frozen-lockfile --ignore-scripts
chown -R root:root /opt/woozooclass/releases/RELEASE_COMMIT
chmod -R go-w /opt/woozooclass/releases/RELEASE_COMMIT
install -d -m 0750 -o root -g woozooclass /etc/woozooclass
install -d -m 0700 -o woozooclass -g woozooclass /var/lib/woozooclass /var/lib/woozooclass/classes
install -d -m 0700 -o root -g root /var/backups/woozooclass
node deploy/init-env.mjs
ln -s /opt/woozooclass/releases/RELEASE_COMMIT /opt/woozooclass/current
install -m 0644 deploy/woozooclass.service /etc/systemd/system/woozooclass.service
install -m 0755 deploy/backup.sh /usr/local/sbin/woozooclass-backup
install -m 0644 deploy/woozooclass-backup.service /etc/systemd/system/woozooclass-backup.service
install -m 0644 deploy/woozooclass-backup.timer /etc/systemd/system/woozooclass-backup.timer
systemd-analyze verify /etc/systemd/system/woozooclass.service /etc/systemd/system/woozooclass-backup.service /etc/systemd/system/woozooclass-backup.timer
systemctl daemon-reload
systemctl enable --now woozooclass.service
bash deploy/check-host.sh
```

`init-env.mjs`는 매번 서로 다른 비밀값을 만들고 기존 파일이 있으면 실패한다. 관리자는 비공개 서버 콘솔에서만 `app.env`를 열어 `ADMIN_PASSWORD`를 확인한다. 대화·스크린샷·Git에 출력하지 않는다. `TEACHER_KEY`는 교사 접속 코드 암호화에 쓰이므로 나중에 임의로 바꾸지 않는다.

비공개 조합법 `/etc/woozooclass/crafting-recipes.json`은 자동 생성·복사하지 않는다. 없으면 공개 조합법만 제공된다. 기존 교실과 별개인 게임 조합법을 추후 추가한다면 파일 내용·출처를 확인하고 root:woozooclass 0640으로 설치한 뒤 앱을 재시작한다.

## 4. DNS와 HTTPS

`woozooclass.kr`의 A 레코드를 실제 서버 IPv4로 연결한다. AAAA가 있다면 같은 서버의 유효 IPv6로 연결하거나 사용하지 않는 값을 제거한다. 서버/클라우드 방화벽에서 TCP 80·443을 허용하고 3000은 공개하지 않는다. SSH 접근 규칙은 관리 연결을 확인한 뒤 별도로 설정한다. 이 구성은 `www` 주소를 사용하지 않는다.

기존 Caddyfile을 백업하고 내용·다른 서비스 유무를 확인한 뒤 교체한다. 아래는 이 사이트만 운영하는 새 서버 기준이다.

```sh
test ! -e /etc/caddy/Caddyfile.before-woozooclass
cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-woozooclass
install -m 0644 /opt/woozooclass/current/deploy/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy
bash /opt/woozooclass/current/deploy/check-host.sh --public
```

Caddy가 인증서 발급·갱신과 HTTP→HTTPS 전환을 처리한다. Socket.IO WebSocket도 같은 프록시를 지난다. `/health`와 polling handshake 검사는 WebSocket 실제 업그레이드를 대신하지 않으므로 마지막으로 브라우저에서 HTTPS 학생·교사 입장, WebSocket 연결, 새 교실 저장 후 앱 재시작·동일 계정 재입장을 확인한다. 기존 교실 자료를 이 검사에 사용하지 않는다.

현재 서버의 교사/관리자 로그인 실패 제한은 직접 연결 IP 기준이다. Caddy 뒤에서는 실패 횟수가 프록시 주소로 합산되어 여러 교사가 1분 제한을 공유할 수 있다. 헤더를 무조건 신뢰하도록 바꾸지 않았으며, 다중 교실 확대 전에는 신뢰 프록시 범위를 제한한 별도 개선이 필요하다.

## 5. 백업·재시작·복구

```sh
systemctl start woozooclass-backup.service
systemctl enable --now woozooclass-backup.timer
systemctl list-timers woozooclass-backup.timer
journalctl -u woozooclass-backup.service -n 20 --no-pager
systemctl restart woozooclass.service
bash /opt/woozooclass/current/deploy/check-host.sh --public
```

백업은 매일 04:10 KST에 앱을 잠깐 정상 종료하고 `/etc/woozooclass`와 `/var/lib/woozooclass`를 함께 압축한다. 압축 목록과 SHA-256을 확인하고 원래 실행 중이던 앱을 다시 시작한다. 중단되었던 서버는 자동으로 켜지 않는다. 예약 시각에 서버가 꺼져 있으면 그날 백업을 건너뛰어 낮 시간에 뒤늦게 수업을 끊지 않는다. 생성한 백업·체크섬 중 14일보다 오래된 파일은 자동 삭제되므로 필요한 장기 보관본은 따로 보존한다.

백업 안에는 학생 자료와 서버 비밀값이 있다. 웹 경로나 공개 저장소로 옮기지 않는다. **같은 디스크의 로컬 백업만으로 서버 삭제·디스크 고장에 대비할 수 없다. 외부 암호화 백업·복구 연습은 아직 미구성이다.** 압축 검사는 실제 교실 복원 검증과 다르다.

앱이 비정상 종료되면 systemd가 재시도하며, 시작 전 저장 잠금의 이전 PID가 죽은 경우에만 잠금을 해제한다. PID가 살아 있거나 확인할 수 없으면 자료를 보존하고 시작을 거부한다. 이런 경우 `journalctl -u woozooclass.service`와 프로세스를 확인한다. 잠금 파일을 무조건 삭제하지 않는다.

복구는 앱과 백업 타이머를 먼저 멈추고, 백업 체크섬을 확인한 뒤 별도 디렉터리에 풀어 내용·권한을 검사한다. 현재 설정·자료도 따로 보존한 후 승인한 백업으로 교체한다. 기존 새 교실을 덮어쓰는 자동 복구 명령은 제공하지 않는다. 설정과 자료는 같은 시점의 쌍으로 복구한다.

## 6. 코드 업데이트

수업 밖 시간에 새 커밋을 별도 `releases/<commit>`에 풀고 고정 lockfile로 운영 의존성을 설치한다. 기존 `app.env`와 자료는 계속 사용하며 초기화 도구를 다시 실행하지 않는다. 로컬 백업을 만든 뒤 앱을 중지하고 `current` 링크를 새 릴리스로 바꿔 시작한다. 실패하면 앱을 중지하고 이전 링크로 되돌린다. 저장 형식 변경이 있는 업데이트는 이전 코드만 되돌려도 복구된다고 가정하지 말고 그 변경의 자료 호환성·복구 절차를 따른다. 사용 중인 릴리스와 유일한 정상 백업을 삭제하지 않는다.

공개 GitHub 저장소의 검수한 40자리 커밋을 서버 비공개 root 콘솔에서 배포할 때는 `deploy/update-from-github.sh <커밋 SHA>`를 사용할 수 있다. 스크립트는 해당 SHA의 릴리스를 새 폴더에 내려받아 설치하고, 운영 자료·설정을 백업한 뒤 심볼릭 링크를 교체한다. 재시작·공개 점검이 실패하면 이전 링크로 되돌린다. 기존 교실 자료와 비밀 설정은 GitHub에서 내려받지 않는다. 스크립트 자체도 같은 SHA의 GitHub 원본에서 받아 `bash -n`으로 문법을 검사한 다음 실행한다.

## 근거와 검증 범위

- [Node 24.22.1 공식 릴리스](https://nodejs.org/en/blog/release/v24.22.1)
- [Caddy 자동 HTTPS의 DNS·포트 조건](https://caddyserver.com/docs/automatic-https)
- [Caddy reverse_proxy와 WebSocket](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [systemd 서비스 실행 환경](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)

로컬 Windows에서는 Node 구성 생성·부팅 검증과 Bash 문법 검사를 수행할 수 있다. 실제 Ubuntu systemd 단위 검증, Caddy 설정 검증, 인증서 발급, 백업 실행·복구, 외부 접속은 해당 서버에서 위 절차로 별도 확인한다.
