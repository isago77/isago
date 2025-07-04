# 정적 의존성

| 종속성 | 필수 버전 |
| ------- | ------- |
| [Docker](https://www.docker.com) | Latest |
| [Node.js](https://nodejs.org/) | 22.17.0 |

# 설정하기
server/ 폴더에 `.env` 파일을 생성하고 아래 형식에 따라 코드를 작성합니다.

```env
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
ASSETS_SERVER_HOST=localhost
ASSETS_SERVER_PORT=8081
ASSETS_SERVER_API_KEY=...
```

그런 다음, 마찬가지로 server/ 폴더에 `redis.conf` 파일을 생성하고 아래 형식에 따라 코드를 작성합니다.

```conf
requirepass ...{0}
```

# 시작하기
터미널에서 다음 명령을 차례로 입력합니다.

- `npm install`: NPM 패키지 초기화.
- `npm run build`: Git 서브 모듈을 이용하여 필수 패키지 다운로드.
- `npm run setup`: docker compose를 사용하여 개발 환경 구축.
- `npm run watch` or `npm run start`