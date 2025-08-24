# PDCA 관리 웹서비스 상세 설계서

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
- 회사 멤버들의 PDCA(Plan-Do-Check-Action) 업무 계획 및 실행 관리
- 개인별/팀별/전사적 업무 현황 가시화
- 모바일 친화적 웹 인터페이스 제공
- 프로젝트명 : ED&C PDCA

### 1.2 기술 스택
- **Backend**: Node.js + Express.js
- **Database**: SQLite (무료, 설치 간편)
- **Frontend**: HTML5 + CSS3 or Tailwind CSS + JavaScript (Vanilla)
- **UI Framework**: Bootstrap 5 (반응형 디자인)
- **Process Manager**: PM2
- **Calendar Library**: FullCalendar.js
- **Localization**: 한국어(ko-KR), Seoul 시간대(Asia/Seoul)

### 1.3 배포 환경
- **OS**: Rocky Linux 9
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx (선택사항)

## 2. 시스템 아키텍처

### 2.1 전체 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Static)      │<-->│   (Express)     │<-->│   (SQLite)      │
│   Port: 3000    │    │   Port: 3001    │    │   File: db.db   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2.2 디렉토리 구조
```
pdca-system/
├── .env                    # 환경설정 파일
├── package.json
├── ecosystem.config.js     # PM2 설정
├── backend/
│   ├── server.js          # 메인 서버 파일
│   ├── routes/
│   │   ├── auth.js        # 인증 라우트
│   │   ├── plans.js       # 계획 관리
│   │   ├── users.js       # 사용자 관리
│   │   └── teams.js       # 팀 관리
│   ├── models/
│   │   └── database.js    # 데이터베이스 모델
│   ├── middleware/
│   │   └── auth.js        # 인증 미들웨어
│   └── utils/
│       └── helpers.js     # 유틸리티 함수
├── frontend/
│   ├── index.html         # 메인 페이지
│   ├── login.html         # 로그인 페이지
│   ├── css/
│   │   └── style.css      # 커스텀 스타일
│   ├── js/
│   │   ├── app.js         # 메인 애플리케이션
│   │   ├── calendar.js    # 캘린더 관련
│   │   ├── auth.js        # 인증 관련
│   │   ├── api.js         # API 통신
│   │   └── i18n.js        # 한국어 다국어 지원
│   └── assets/
└── database/
    └── pdca.db           # SQLite 데이터베이스
```

## 3. 데이터베이스 설계

### 3.1 테이블 구조

#### 3.1.1 users (사용자)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role ENUM('member', 'manager', 'admin') DEFAULT 'member',
    team_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id)
);
```

#### 3.1.2 teams (팀)
```sql
CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id)
);
```

#### 3.1.3 plans (계획)
```sql
CREATE TABLE plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type ENUM('daily', 'weekly', 'monthly') NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    plan_date DATE NOT NULL,
    start_time TIME DEFAULT '09:00',
    end_time TIME DEFAULT '17:00',
    work_type ENUM('office', 'field') DEFAULT 'office',
    location TEXT,
    status ENUM('planned', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned',
    is_recurring BOOLEAN DEFAULT FALSE,
    parent_plan_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_plan_id) REFERENCES plans(id)
);
```

#### 3.1.4 pdca_records (PDCA 기록)
```sql
CREATE TABLE pdca_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    do_content TEXT,
    check_content TEXT,
    action_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);
```

### 3.2 인덱스 설정
```sql
CREATE INDEX idx_plans_user_date ON plans(user_id, plan_date);
CREATE INDEX idx_plans_date ON plans(plan_date);
CREATE INDEX idx_users_team ON users(team_id);
```

## 4. API 설계

### 4.1 인증 API

#### 4.1.1 로그인
- **POST** `/api/auth/login`
- **Request Body**: `{ username, password }`
- **Response**: `{ success, token, user: { id, name, role, team_id } }`

#### 4.1.2 로그아웃
- **POST** `/api/auth/logout`
- **Headers**: `Authorization: Bearer <token>`

### 4.2 계획 관리 API

#### 4.2.1 계획 목록 조회
- **GET** `/api/plans?date=2024-01&type=monthly`
- **Query Parameters**: 
  - `date`: 조회 날짜/기간 (YYYY-MM-DD 또는 YYYY-MM)
  - `type`: daily, weekly, monthly
  - `user_id`: 특정 사용자 (관리자/팀장만)

#### 4.2.2 계획 생성
- **POST** `/api/plans`
- **Request Body**:
```json
{
  "type": "daily",
  "title": "프로젝트 A 개발",
  "description": "API 개발 및 테스트",
  "plan_date": "2024-03-15",
  "start_time": "09:00",
  "end_time": "18:00",
  "work_type": "office",
  "location": null
}
```

#### 4.2.3 계획 수정
- **PUT** `/api/plans/:id`

#### 4.2.4 계획 복사
- **POST** `/api/plans/:id/copy`
- **Request Body**:
```json
{
  "target_dates": ["2024-03-16", "2024-03-17", "2024-03-18"],
  "copy_pdca": false
}
```

#### 4.2.5 계획 삭제
- **DELETE** `/api/plans/:id`

### 4.3 PDCA 기록 API

#### 4.3.1 PDCA 기록 저장/수정
- **POST/PUT** `/api/pdca/:plan_id`
- **Request Body**:
```json
{
  "do_content": "API 개발 완료, 단위 테스트 작성",
  "check_content": "기능은 정상 동작하나 성능 개선 필요",
  "action_content": "다음 주 성능 최적화 계획 수립"
}
```

### 4.4 사용자/팀 관리 API

#### 4.4.1 팀 멤버 조회
- **GET** `/api/teams/:team_id/members`

#### 4.4.2 전체 사용자 조회 (관리자만)
- **GET** `/api/users`

## 5. 프론트엔드 설계

### 5.1 주요 화면 구성

#### 5.1.1 로그인 화면 (login.html)
- 사용자명/비밀번호 입력
- 모바일 친화적 레이아웃

#### 5.1.2 메인 대시보드 (index.html)
- 상단: 사용자 정보, 설정 버튼, 로그아웃 버튼
- 네비게이션: 내 캘린더, 팀 캘린더, 전체 캘린더 (권한별)
- 중앙: 캘린더 뷰 (FullCalendar.js) - 한국어 로케일
- 하단: 새 계획 추가 버튼

#### 5.1.3 계획 편집 모달
- 계획 유형 선택 (일별/주별/월별)
- 제목, 설명 입력
- 일별 계획시: 시간, 근무형태, 위치 설정
- PDCA 입력 영역
- 다중 날짜 복사 옵션

### 5.2 반응형 디자인
- Bootstrap 5 그리드 시스템 활용
- 모바일: 단일 컬럼 레이아웃
- 태블릿/데스크톱: 사이드바 + 메인 콘텐츠

### 5.3 캘린더 기능

#### 5.3.1 개인 캘린더
- 월간/주간/일간 뷰 전환 (한국어 메뉴)
- 한국 시간대 (Asia/Seoul) 기준 표시
- 계획 클릭시 상세 정보 표시
- 빈 날짜 더블클릭으로 새 계획 생성
- 드래그&드롭 기능:
  - **단순 이동**: 계획을 다른 날짜로 드래그
  - **복사 모드**: Ctrl/Cmd 키 + 드래그로 복사
  - **다중 복사**: 우클릭 메뉴에서 "여러 날짜에 복사" 선택

#### 5.3.2 팀 캘린더 (팀장)
- 체크박스로 팀원별 표시/숨김
- 색상별로 팀원 구분
- 팀원 계획 읽기 전용
- 한국어 팀원명 표시

#### 5.3.3 전체 캘린더 (관리자)
- 부서별/전체 선택 가능
- 통계 정보 표시 (한국어)
- 월별/주별 업무 현황 요약

## 6. 환경 설정 (.env)

```env
# 서버 설정
HOST_IP=192.168.1.100
FRONTEND_PORT=3000
BACKEND_PORT=3001

# 로케일 설정
TIMEZONE=Asia/Seoul
LOCALE=ko-KR

# 데이터베이스
DB_PATH=./database/pdca.db

# JWT 설정
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRE=24h

# 기본 관리자 계정
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_NAME=관리자
ADMIN_EMAIL=admin@company.com
```

## 7. PM2 설정 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'pdca-backend',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'pdca-frontend',
    script: 'serve',
    env: {
      PM2_SERVE_PATH: './frontend',
      PM2_SERVE_PORT: process.env.FRONTEND_PORT || 3000,
      PM2_SERVE_SPA: 'true'
    }
  }]
};
```

## 8. 보안 고려사항

### 8.1 인증/인가
- JWT 토큰 기반 인증
- 비밀번호 해싱 (bcrypt)
- 세션 만료 관리

### 8.2 데이터 접근 제어
- 개인: 본인 데이터만 접근
- 팀장: 팀원 데이터 읽기
- 관리자: 전체 데이터 접근

### 8.3 입력 데이터 검증
- SQL Injection 방지
- XSS 공격 방지
- 파라미터 유효성 검사

## 9. 구현 순서

### Phase 1 (핵심 기능)
1. 데이터베이스 스키마 생성
2. 사용자 인증 시스템
3. 기본 CRUD API 구현
4. 간단한 캘린더 뷰

### Phase 2 (고급 기능)
1. 팀별 권한 관리
2. 모바일 최적화
3. PDCA 입력 인터페이스
4. 데이터 필터링

### Phase 3 (사용성 개선)
1. 드래그&드롭 기능
2. 통계 및 리포트
3. 알림 기능
4. 데이터 백업/복원

## 10. 배포 가이드

### 10.1 초기 설정
```bash
# 프로젝트 클론 및 의존성 설치
git clone <repository>
cd pdca-system
npm install

# 환경 파일 설정
cp .env.example .env
nano .env

# 데이터베이스 초기화
node backend/models/database.js

# PM2로 서비스 시작
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 10.2 서비스 관리
```bash
# 서비스 상태 확인
pm2 status

# 로그 확인
pm2 logs pdca-backend
pm2 logs pdca-frontend

# 서비스 재시작
pm2 restart all
```

## 11. 예상 리소스 사용량

- **메모리**: 약 200MB (Node.js 프로세스 2개)
- **디스크**: 약 100MB (코드 + 의존성)
- **CPU**: 낮음 (일반적인 CRUD 작업)
- **네트워크**: 최소 (정적 파일 + API 호출)

## 12. 한국어 UI/UX 설계

### 12.1 주요 메뉴 한국어 구성

#### 12.1.1 네비게이션 메뉴
```javascript
const menuLabels = {
  dashboard: '대시보드',
  myCalendar: '내 캘린더',
  teamCalendar: '팀 캘린더',
  allCalendar: '전체 캘린더',
  profile: '프로필',
  settings: '설정',
  logout: '로그아웃'
};
```

#### 12.1.2 계획 관련 용어
```javascript
const planLabels = {
  daily: '일별 계획',
  weekly: '주별 계획',
  monthly: '월별 계획',
  office: '내근',
  field: '외근',
  planned: '계획됨',
  inProgress: '진행중',
  completed: '완료',
  cancelled: '취소됨'
};
```

#### 12.1.3 PDCA 용어
```javascript
const pdcaLabels = {
  plan: '계획 (Plan)',
  do: '실행 (Do)',
  check: '점검 (Check)',
  action: '조치 (Action)'
};
```

### 12.2 FullCalendar 한국어 설정
```javascript
// calendar.js에서 설정
const calendarConfig = {
  locale: 'ko',
  timeZone: 'Asia/Seoul',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  buttonText: {
    today: '오늘',
    month: '월',
    week: '주',
    day: '일'
  },
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', 
               '7월', '8월', '9월', '10월', '11월', '12월']
};
```

### 12.3 드래그&드롭 복사 기능 상세 설계

#### 12.3.1 복사 모드 구현
```javascript
// 드래그 시작시 키 상태 감지
let copyMode = false;

calendar.on('eventDragStart', function(info) {
  copyMode = info.jsEvent.ctrlKey || info.jsEvent.metaKey;
  
  // 복사 모드 시각적 피드백
  if (copyMode) {
    info.el.style.opacity = '0.7';
    info.el.style.border = '2px dashed #007bff';
  }
});

calendar.on('eventDrop', function(info) {
  if (copyMode) {
    // 원본 위치로 되돌리고 복사본 생성
    info.revert();
    createCopyPlan(info.event, info.newStart);
  }
});
```

#### 12.3.2 다중 날짜 복사 모달
```html
<div class="modal fade" id="multiCopyModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5>여러 날짜에 복사</h5>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>복사할 날짜 선택</label>
          <input type="text" id="dateRangePicker" class="form-control">
        </div>
        <div class="form-check">
          <input type="checkbox" id="copyPdca">
          <label>PDCA 내용도 함께 복사</label>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary">취소</button>
        <button type="button" class="btn btn-primary">복사</button>
      </div>
    </div>
  </div>
</div>
```

#### 12.3.3 우클릭 컨텍스트 메뉴
```javascript
calendar.on('eventRightClick', function(info) {
  showContextMenu(info.jsEvent, [
    { label: '수정', action: () => editPlan(info.event) },
    { label: '삭제', action: () => deletePlan(info.event) },
    { separator: true },
    { label: '다른 날짜로 이동', action: () => showMoveModal(info.event) },
    { label: '여러 날짜에 복사', action: () => showMultiCopyModal(info.event) }
  ]);
});
```

### 12.4 날짜/시간 포맷팅
```javascript
// 한국 로케일 날짜 포맷팅 함수
function formatKoreanDate(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul'
  }).format(date);
}

function formatKoreanTime(time) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  }).format(new Date(`2000-01-01T${time}`));
}
```