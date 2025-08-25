const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.FRONTEND_PORT || 3000;

// 정적 파일 서빙 (프론트엔드)
app.use(express.static(path.join(__dirname, 'frontend')));

// 백엔드 포트 설정을 프론트엔드에 제공
app.get('/config.js', (_, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.CONFIG = { BACKEND_PORT: ${process.env.BACKEND_PORT || 3001} };`);
});

// SPA 라우팅 - 모든 요청을 index.html로 라우팅
app.get('*', (req, res) => {
  // 로그인 페이지 요청인 경우
  if (req.path.includes('login')) {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
  } else {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`==============================================`);
  console.log(`🖥️  ED&C PDCA 프론트엔드 서버가 시작되었습니다`);
  console.log(`📍 프론트엔드: http://${process.env.HOST_IP}:${PORT}`);
  console.log(`🔗 API 서버: http://${process.env.HOST_IP}:${process.env.BACKEND_PORT || 3001}`);
  console.log(`==============================================`);
});

module.exports = app;