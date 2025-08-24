const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 인증이 필요없는 라우트들
// 사용자 등록 신청 (self-registration)
router.post('/register', (req, res) => {
  const { username, password, name, email, team_id } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ error: '사용자명, 비밀번호, 이름은 필수입니다.' });
  }

  const db = getDatabase();
  
  // 중복 사용자명 확인
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }
    
    if (row) {
      return res.status(409).json({ error: '이미 사용 중인 사용자명입니다.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    
    db.run(
      `INSERT INTO users (username, password, name, email, role, team_id) 
       VALUES (?, ?, ?, ?, 'member', ?)`,
      [username, hashedPassword, name, email || null, team_id || null],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '사용자 등록 중 오류가 발생했습니다.' });
        }
        
        res.status(201).json({ 
          success: true, 
          message: '사용자 등록이 완료되었습니다.',
          user: { 
            id: this.lastID, 
            username, 
            name,
            email,
            role: 'member',
            team_id
          } 
        });
      }
    );
  });
});

// 모든 라우트에 인증 미들웨어 적용 (register 제외)
router.use(authenticateToken);

// 전체 사용자 목록 조회 (관리자만)
router.get('/', requireAdmin, (req, res) => {
  const db = getDatabase();
  
  db.all(
    `SELECT u.id, u.username, u.name, u.email, u.role, u.team_id, 
            t.name as team_name, u.created_at
     FROM users u 
     LEFT JOIN teams t ON u.team_id = t.id 
     ORDER BY u.created_at DESC`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      // 비밀번호 제거
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json({ success: true, users: safeUsers });
    }
  );
});

// 관리자가 새 사용자 생성
router.post('/', requireAdmin, (req, res) => {
  const { username, password, name, email, role, team_id } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ error: '사용자명, 비밀번호, 이름은 필수입니다.' });
  }

  if (role && !['member', 'manager', 'admin'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  }

  const db = getDatabase();
  
  // 중복 사용자명 확인
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }
    
    if (row) {
      return res.status(409).json({ error: '이미 사용 중인 사용자명입니다.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 12);
    
    db.run(
      `INSERT INTO users (username, password, name, email, role, team_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, name, email || null, role || 'member', team_id || null],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '사용자 생성 중 오류가 발생했습니다.' });
        }
        
        res.status(201).json({ 
          success: true, 
          message: '사용자가 생성되었습니다.',
          user: { 
            id: this.lastID, 
            username, 
            name,
            email,
            role: role || 'member',
            team_id
          } 
        });
      }
    );
  });
});

// 사용자 정보 수정 (관리자만)
router.put('/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { name, email, role, team_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '이름은 필수입니다.' });
  }

  if (role && !['member', 'manager', 'admin'].includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  }

  const db = getDatabase();
  
  db.run(
    `UPDATE users SET name = ?, email = ?, role = ?, team_id = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [name, email || null, role || 'member', team_id || null, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '사용자 정보 수정 중 오류가 발생했습니다.' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }
      
      res.json({ success: true, message: '사용자 정보가 수정되었습니다.' });
    }
  );
});

// 사용자 삭제 (관리자만)
router.delete('/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  
  // 관리자 자신은 삭제할 수 없음
  if (parseInt(userId) === req.user.id) {
    return res.status(409).json({ error: '자신의 계정은 삭제할 수 없습니다.' });
  }

  const db = getDatabase();
  
  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: '사용자 삭제 중 오류가 발생했습니다.' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    res.json({ success: true, message: '사용자가 삭제되었습니다.' });
  });
});

// 특정 사용자 정보 조회
router.get('/:id', (req, res) => {
  const userId = req.params.id;
  const db = getDatabase();

  // 권한 확인 (본인, 관리자, 같은 팀 멤버)
  if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
    // 같은 팀 멤버인지 확인
    db.get(
      `SELECT team_id FROM users WHERE id = ?`,
      [userId],
      (err, targetUser) => {
        if (err) {
          return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
        }

        if (!targetUser) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 같은 팀이 아니면 접근 거부
        if (!req.user.team_id || req.user.team_id !== targetUser.team_id) {
          return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }

        // 같은 팀이면 사용자 정보 조회 진행
        getUserDetails(res, db, userId);
      }
    );
    return;
  }

  // 본인이거나 관리자면 바로 조회
  getUserDetails(res, db, userId);
});

// 사용자 상세 정보 조회 헬퍼 함수
function getUserDetails(res, db, userId) {
  db.get(
    `SELECT u.id, u.username, u.name, u.email, u.role, u.team_id, 
            t.name as team_name, u.created_at, u.updated_at
     FROM users u 
     LEFT JOIN teams t ON u.team_id = t.id 
     WHERE u.id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!user) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      res.json({ success: true, user });
    }
  );
}

// 관리자 통계 조회
router.get('/admin/stats', requireAdmin, (req, res) => {
  const db = getDatabase();
  
  // 통계 쿼리들을 병렬로 실행
  const queries = [
    // 전체 사용자 수
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
        if (err) reject(err);
        else resolve({ totalUsers: result.count });
      });
    }),
    
    // 전체 팀 수
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM teams', [], (err, result) => {
        if (err) reject(err);
        else resolve({ totalTeams: result.count });
      });
    }),
    
    // 전체 계획 수
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM plans', [], (err, result) => {
        if (err) reject(err);
        else resolve({ totalPlans: result.count });
      });
    }),
    
    // 활성 사용자 수 (최근 30일 내 계획이 있는 사용자)
    new Promise((resolve, reject) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      db.get(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM plans 
         WHERE created_at >= ?`,
        [dateStr],
        (err, result) => {
          if (err) reject(err);
          else resolve({ activeUsers: result.count });
        }
      );
    })
  ];
  
  Promise.all(queries)
    .then(results => {
      const stats = Object.assign({}, ...results);
      res.json({ success: true, stats });
    })
    .catch(err => {
      console.error('통계 조회 오류:', err);
      res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
    });
});

module.exports = router;