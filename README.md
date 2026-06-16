> [!WARNING]
> 🔒 The `firebase-service-account.json` and config files remaining in this repository belong to a permanently disabled/dead Firebase project used solely during development. No active production keys or sensitive `.env` credentials exist here. It remains public strictly for architectural and code review purposes.

# 정적 의존성

| 종속성 | 필수 버전 |
| ------- | ------- |
| [Docker](https://www.docker.com) | Latest |
| [Node.js](https://nodejs.org/) | 22.17.0 |

# 설정하기
server/ 폴더에 `.env` 파일을 생성하고 아래 형식에 따라 코드를 작성합니다. 또는 /test/test.env를 복사하여 최상위 폴더에 붙여넣기 하고 해당 파일에 대한 이름을 `.env`으로 변경하는 방법이 있습니다.

```env
SERVER_PORT=8080
SERVER_MODE=debug
DECRYPTION_KEY=...
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=root
MARIADB_DATABASE=isago
MARIADB_PASSWORD=...
MARIADB_POOL_LIMIT=5

REDIS_PORT=6379
REDIS_PASSWORD=...{0}

EMAIL_USERNAME=isagoapp@gmail.com
EMAIL_PASSWORD=...

COOLSMS_API_KEY=...
COOLSMS_SECRET_KEY=...
COOLSMS_PHONE_NUMBER=...

# API 서버가 Assets 서버에 접근하기 위한 필수 설정.
ASSETS_SERVER_PROTOCOL=http
ASSETS_SERVER_HOST=localhost
ASSETS_SERVER_PORT=8081
ASSETS_SERVER_API_KEY=...

# 결제 수단인 토스페이먼츠 API에 대한 필수 설정.
TOSS_SECRET_KEY=...
```

그런 다음, 마찬가지로 server/ 폴더에 `redis.conf` 파일을 생성하고 아래 형식에 따라 코드를 작성합니다.

```conf
requirepass ...{0}
```

## Firebase
기존 Firebase 서비스 계정이 변경되었거나 새로운 계정을 사용하는 경우, 기존의 `firebase-service-account.json` 파일을 삭제한 뒤 새로운 비공개 키를 생성하여 다시 설정해야 합니다.

![firebase-console](https://github.com/user-attachments/assets/1b0e85d5-f55e-435b-aacc-d5638324208b)

# 배포하기
릴리스 환경에서 배포하기 위해서는 몇 가지 설정이 더 필요합니다. 우선 최상위 폴더에 `/ssl`라는 하위 폴더를 생성하고 HTTPS 인증서를 위한 `private.key`와 `certificate.crt` 파일을 해당 폴더에 삽입하세요.

```
ssl/private.key
ssl/ca_bundle.crt
ssl/certificate.crt
```

# 시작하기
터미널에서 다음 명령을 차례로 입력합니다.

- `npm install`: NPM 패키지 초기화.
- `npm run build`: Git 서브 모듈을 이용하여 필수 패키지 다운로드.
- `npm run setup`: docker compose를 사용하여 개발 환경 구축.
- `npm run watch` or `npm run start`
