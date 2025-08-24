const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initializeDatabase } = require('./models/database');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 3000;

// 미들웨어 설정
app.use(cors({
  origin: [
    `http://${process.env.HOST_IP}:${FRONTEND_PORT}`,
    `http://localhost:${FRONTEND_PORT}`,
    `http://127.0.0.1:${FRONTEND_PORT}`
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/users', require('./routes/users'));
app.use('/api/teams', require('./routes/teams'));

// API 상태 확인
app.get('/', (req, res) => {
  res.json({ 
    message: 'ED&C PDCA API Server', 
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 에러 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 에러:', err.stack);
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 데이터베이스 초기화 후 서버 시작
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`==============================================`);
      console.log(`🚀 ED&C PDCA 서버가 시작되었습니다`);
      console.log(`📍 백엔드 서버: http://${process.env.HOST_IP}:${PORT}`);
      console.log(`🖥️  프론트엔드: http://${process.env.HOST_IP}:${FRONTEND_PORT}`);
      console.log(`🌏 로케일: ${process.env.LOCALE}`);
      console.log(`⏰ 시간대: ${process.env.TIMEZONE}`);
      console.log(`==============================================`);
    });
  })
  .catch((err) => {
    console.error('서버 시작 실패:', err);
    process.exit(1);
  });

module.exports = app;