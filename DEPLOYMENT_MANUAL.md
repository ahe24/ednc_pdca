# ED&C PDCA System - 배포 매뉴얼

## 시스템 개요

ED&C PDCA는 PDCA (Plan-Do-Check-Action) 관리 시스템으로 Node.js + Express.js 백엔드와 Vanilla JavaScript 프론트엔드로 구성되어 있습니다.

## 서버 요구사항

### 최소 시스템 요구사항
- **OS**: Linux (Ubuntu 18.04+ 권장) 또는 CentOS 7+
- **CPU**: 1 Core 이상
- **RAM**: 1GB 이상 (2GB 권장)
- **Storage**: 5GB 이상 여유 공간
- **Network**: HTTP 포트 접근 가능 (80, 3000, 3001)

### 소프트웨어 요구사항
- **Node.js**: v16.x 이상 (v18.x 권장)
- **npm**: v8.x 이상
- **PM2**: 글로벌 설치 필요
- **SQLite3**: Node.js 패키지에 포함됨

## 배포 준비사항

### 1. Node.js 설치
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2. PM2 글로벌 설치
```bash
sudo npm install -g pm2
```

### 3. 프로젝트 클론 및 의존성 설치
```bash
# 프로젝트 클론
git clone https://github.com/ahe24/ednc_pdca.git
cd ednc_pdca

# 의존성 설치
npm install
```

## 배포 과정

### 1. 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env
nano .env
```

**.env 파일 예시:**
```env
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000
DB_PATH=./database/pdca.db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=30d
UPLOAD_MAX_SIZE=1048576
UPLOAD_PATH=./uploads
LOG_LEVEL=info
TZ=Asia/Seoul
```

### 2. 데이터베이스 초기화
```bash
# 데이터베이스 디렉토리 생성
mkdir -p database

# 데이터베이스 초기화 (테이블 생성 및 기본 데이터 삽입)
node backend/models/database.js
```

### 3. PM2 생태계 설정
**ecosystem.config.js 파일 확인 및 수정:**
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
      NODE_ENV: 'production',
      PORT: 3001
    }
  }, {
    name: 'pdca-frontend',
    script: 'serve',
    env: {
      PM2_SERVE_PATH: './frontend',
      PM2_SERVE_PORT: 3000,
      PM2_SERVE_SPA: 'true',
      PM2_SERVE_HOMEPAGE: '/index.html'
    }
  }]
}
```

### 4. PM2로 애플리케이션 시작
```bash
# PM2로 앱 시작
pm2 start ecosystem.config.js

# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs
```

### 5. PM2 자동 시작 설정
```bash
# 시스템 재부팅 시 PM2 자동 시작 설정
pm2 startup
pm2 save
```

## 네트워크 및 방화벽 설정

### 방화벽 포트 열기
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000
sudo ufw allow 3001

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### Nginx 리버스 프록시 설정 (선택사항)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 프론트엔드
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 백엔드
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 데이터베이스 관리

### 백업
```bash
# 데이터베이스 백업
cp database/pdca.db database/pdca_backup_$(date +%Y%m%d_%H%M%S).db

# 백업 스크립트 (cron job으로 설정 가능)
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DB_PATH="/path/to/ednc_pdca/database/pdca.db"
DATE=$(date +%Y%m%d_%H%M%S)
cp $DB_PATH $BACKUP_DIR/pdca_backup_$DATE.db
```

### 복원
```bash
# 서비스 중지
pm2 stop all

# 데이터베이스 파일 복원
cp database/pdca_backup_YYYYMMDD_HHMMSS.db database/pdca.db

# 서비스 재시작
pm2 start all
```

## 모니터링 및 로그 관리

### PM2 모니터링
```bash
# PM2 대시보드
pm2 monit

# 실시간 로그
pm2 logs --lines 100

# 특정 앱 로그
pm2 logs pdca-backend
pm2 logs pdca-frontend

# 로그 파일 위치
~/.pm2/logs/
```

### 로그 로테이션 설정
```bash
# PM2 로그 로테이션 모듈 설치
pm2 install pm2-logrotate

# 로그 로테이션 설정
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## 업데이트 및 유지보수

### 애플리케이션 업데이트
```bash
# 코드 업데이트
git pull origin main

# 의존성 업데이트 (필요시)
npm install

# 무중단 재시작
pm2 reload all

# 또는 개별 재시작
pm2 restart pdca-backend
pm2 restart pdca-frontend
```

### 시스템 상태 점검
```bash
# 프로세스 상태 확인
pm2 status

# 메모리 사용량 확인
pm2 monit

# 디스크 사용량 확인
df -h

# 네트워크 포트 확인
netstat -tlnp | grep -E ':(3000|3001)'
```

## 문제 해결

### 자주 발생하는 문제

1. **포트 충돌**
   ```bash
   # 포트 사용 프로세스 확인
   sudo lsof -i :3000
   sudo lsof -i :3001
   
   # 프로세스 종료
   sudo kill -9 PID
   ```

2. **데이터베이스 락 문제**
   ```bash
   # PM2 완전 중지
   pm2 kill
   
   # 데이터베이스 파일 권한 확인
   ls -la database/pdca.db
   chmod 644 database/pdca.db
   
   # 재시작
   pm2 start ecosystem.config.js
   ```

3. **메모리 부족**
   ```bash
   # 메모리 확인
   free -h
   
   # PM2 메모리 제한 설정
   pm2 start ecosystem.config.js --max-memory-restart 500M
   ```

### 로그 확인 명령어
```bash
# 에러 로그 확인
pm2 logs --err

# 실시간 로그 스트림
pm2 logs --lines 0

# 로그 파일 직접 확인
tail -f ~/.pm2/logs/pdca-backend-out.log
tail -f ~/.pm2/logs/pdca-backend-error.log
```

## 보안 고려사항

### 기본 보안 설정
1. **JWT 시크릿 키 변경** - .env 파일의 JWT_SECRET 값을 강력한 랜덤 문자열로 변경
2. **데이터베이스 파일 권한** - 644 권한 설정으로 다른 사용자의 읽기 제한
3. **업로드 파일 검증** - 1MB 크기 제한 및 파일 타입 검증
4. **CORS 설정** - 필요한 도메인만 허용
5. **입력값 검증** - SQL 인젝션 및 XSS 방지

### 추가 보안 강화 (권장)
```bash
# UFW 방화벽 활성화
sudo ufw enable

# SSH 포트 변경 및 키 인증만 허용
# fail2ban 설치로 brute force 공격 방지
sudo apt install fail2ban

# 정기적인 시스템 업데이트
sudo apt update && sudo apt upgrade
```

## 성능 최적화

### Node.js 성능 튜닝
```bash
# PM2 클러스터 모드 (CPU 코어 수에 맞게 조정)
pm2 start ecosystem.config.js --instances max

# 메모리 사용량 모니터링
pm2 monit
```

### 데이터베이스 최적화
```sql
-- SQLite 최적화 쿼리 (정기적 실행 권장)
VACUUM;
ANALYZE;
```

## 연락처 및 지원

- **개발자**: cs.jo@ednc.com
- **시스템 관리**: EDA Team
- **회사**: EDMFG

## 변경 이력

- **v1.0**: 초기 배포 매뉴얼 작성
- **배포일**: 2025년

---

**주의사항**: 프로덕션 환경에서는 반드시 백업을 수행한 후 업데이트를 진행하십시오.