const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

// JWT 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
}

// 역할별 접근 권한 검증 미들웨어
function authorizeRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    next();
  };
}

// 관리자 권한 검증
function requireAdmin(req, res, next) {
  return authorizeRole(['admin'])(req, res, next);
}

// 관리자 또는 팀장 권한 검증
function requireManager(req, res, next) {
  return authorizeRole(['admin', 'manager'])(req, res, next);
}

// 팀 접근 권한 검증 (본인 팀 또는 관리자)
function checkTeamAccess(req, res, next) {
  const targetUserId = parseInt(req.params.userId) || parseInt(req.query.user_id);
  
  if (!targetUserId) {
    return next();
  }

  if (req.user.role === 'admin') {
    return next();
  }

  const db = getDatabase();
  db.get(
    `SELECT team_id FROM users WHERE id = ?`,
    [targetUserId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류' });
      }

      if (!row) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      // 본인 데이터 또는 같은 팀 멤버 (모든 팀원이 서로의 데이터 조회 가능)
      if (targetUserId === req.user.id || 
          (req.user.team_id && req.user.team_id === row.team_id)) {
        next();
      } else {
        res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
    }
  );
}

module.exports = {
  authenticateToken,
  authorizeRole,
  requireAdmin,
  requireManager,
  checkTeamAccess
};