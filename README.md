# ED&C PDCA 관리 시스템

계획-실행-점검-조치(PDCA) 업무 관리를 위한 웹 애플리케이션입니다.

## 🚀 주요 기능

- **PDCA 계획 관리**: 일별/주별/월별 계획 생성 및 관리
- **캘린더 뷰**: FullCalendar.js 기반 한국어 캘린더
- **드래그 앤 드롭**: 계획 이동 및 복사 기능
- **권한 관리**: 멤버/팀장/관리자 역할별 접근 제어
- **모바일 최적화**: 반응형 디자인으로 모바일 친화적
- **한국어 지원**: 완전한 한국어 인터페이스 및 로케일

## 🛠 기술 스택

- **Backend**: Node.js + Express.js
- **Database**: SQLite
- **Frontend**: HTML5 + Tailwind CSS + Vanilla JavaScript
- **UI Framework**: Bootstrap 5
- **Calendar**: FullCalendar.js
- **Process Manager**: PM2
- **Authentication**: JWT + bcrypt

## 📋 요구사항

- Node.js 16.0.0 이상
- PM2 (배포시)

## 🔧 설치 및 설정

### 1. 저장소 클론
```bash
git clone https://github.com/ahe24/ednc_pdca.git
cd ednc_pdca
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 설정
`.env` 파일의 설정을 확인하고 필요시 수정하세요:

```env
# 서버 설정
HOST_IP=192.168.1.100
FRONTEND_PORT=3000
BACKEND_PORT=3001

# JWT 설정
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRE=30d

# 기본 관리자 계정
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_NAME=관리자
ADMIN_EMAIL=admin@company.com
```

### 4. 데이터베이스 초기화
```bash
npm run init-db
```

## 🚀 실행

### 개발 모드
```bash
npm run dev
```

### 프로덕션 모드 (PM2)
```bash
# PM2 설치 (전역)
npm install -g pm2

# 서비스 시작
npm run pm2:start

# 서비스 상태 확인
npm run pm2:logs

# 서비스 중지
npm run pm2:stop
```

## 📱 사용법

### 1. 로그인
- 기본 관리자 계정: `admin` / `admin123`
- 브라우저에서 `http://HOST_IP:3000/login.html` 접속

### 2. 계획 관리
- **새 계획 추가**: 캘린더의 빈 날짜 클릭 또는 "새 계획 추가" 버튼
- **계획 수정**: 기존 계획 클릭
- **계획 이동**: 드래그 앤 드롭으로 날짜 변경
- **계획 복사**: 우클릭 메뉴에서 "복사" 선택

### 3. PDCA 기록
- 계획 수정 모달 하단의 PDCA 섹션에서 입력
- **Do**: 실행한 작업 내용
- **Check**: 결과 검토 및 문제점
- **Action**: 개선사항 및 다음 계획

### 4. 권한별 기능
- **멤버**: 본인 계획만 관리
- **팀장**: 팀원 계획 조회 가능
- **관리자**: 전체 계획 관리

## 🔐 보안

- JWT 토큰 기반 인증
- httpOnly 쿠키로 토큰 저장 (1개월 유효)
- bcrypt 비밀번호 해싱
- 역할 기반 접근 제어
- SQL Injection 방지

## 📂 프로젝트 구조

```
ednc_pdca/
├── backend/
│   ├── server.js          # 메인 서버
│   ├── routes/            # API 라우트
│   ├── models/            # 데이터베이스 모델
│   ├── middleware/        # 미들웨어
│   └── utils/             # 유틸리티
├── frontend/
│   ├── index.html         # 메인 대시보드
│   ├── login.html         # 로그인 페이지
│   ├── css/              # 스타일시트
│   ├── js/               # 클라이언트 스크립트
│   └── assets/           # 정적 자원
├── database/
│   └── pdca.db           # SQLite 데이터베이스
├── logs/                 # PM2 로그
├── .env                  # 환경 설정
├── ecosystem.config.js   # PM2 설정
└── package.json
```

## 🔄 API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `GET /api/auth/me` - 현재 사용자 정보

### 계획
- `GET /api/plans` - 계획 목록
- `POST /api/plans` - 계획 생성
- `PUT /api/plans/:id` - 계획 수정
- `DELETE /api/plans/:id` - 계획 삭제
- `POST /api/plans/:id/copy` - 계획 복사
- `POST /api/plans/:id/pdca` - PDCA 기록 저장

### 사용자/팀
- `GET /api/users` - 사용자 목록 (관리자)
- `GET /api/teams/:id/members` - 팀 멤버 조회

## 🐛 트러블슈팅

### 1. 데이터베이스 연결 실패
```bash
# 데이터베이스 재초기화
npm run init-db
```

### 2. 포트 충돌
`.env` 파일에서 `FRONTEND_PORT`, `BACKEND_PORT` 변경

### 3. PM2 로그 확인
```bash
npm run pm2:logs
```

### 4. 권한 문제
- 파일 권한 확인: `chmod 755 backend/server.js`
- PM2 프로세스 확인: `pm2 list`

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. Node.js 버전 (16.0.0 이상)
2. 포트 사용 가능 여부
3. 환경 변수 설정
4. 데이터베이스 파일 권한

## 📝 라이선스

ISC License

## 👥 기여

ED&C 팀에서 개발 및 유지보수