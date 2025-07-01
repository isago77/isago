# 정적 의존성

| 종속성 | 필수 버전 |
| ------- | ------- |
| [Docker](https://www.docker.com) | Latest |
| [Node.js](https://nodejs.org/) | 22.12.0 |

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

EMAIL_USERNAME=isago.dev@gmail.com
EMAIL_PASSWORD=...
```

그런 다음, 마찬가지로 server/ 폴더에 `redis.conf` 파일을 생성하고 아래 형식에 따라 코드를 작성합니다.

```conf
requirepass ...{0}
```

# 시작하기
터미널에서 다음 명령을 차례로 입력합니다.

- `npm install`: NPM 패키지 초기화.
- `npm run setup`: docker compose를 사용하여 개발 환경 구축.
- `npm run watch` or `npm run start`