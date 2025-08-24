const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken, requireAdmin, requireManager } = require('../middleware/auth');

const router = express.Router();

// 팀 목록 조회 (인증 불필요 - 회원가입용, 관리자용은 인증 필요)
router.get('/', (req, res) => {
  const db = getDatabase();
  
  // 관리자 요청인지 확인 (Authorization 헤더가 있으면 관리자로 간주)
  const isAdminRequest = req.headers.authorization || req.cookies.token;
  
  if (isAdminRequest) {
    // 관리자용: 멤버 수 포함
    const query = `
      SELECT t.id, t.name, t.description, t.created_at,
             COUNT(u.id) as member_count
      FROM teams t 
      LEFT JOIN users u ON t.id = u.team_id
      GROUP BY t.id, t.name, t.description, t.created_at
      ORDER BY t.name
    `;

    db.all(query, [], (err, teams) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      res.json({ success: true, teams });
    });
  } else {
    // 기본 팀 정보만 반환 (보안상 민감한 정보 제외)
    const query = `
      SELECT t.id, t.name, t.description
      FROM teams t 
      ORDER BY t.name
    `;

    db.all(query, [], (err, teams) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      res.json({ success: true, teams });
    });
  }
});

// 새 팀 생성 (관리자만)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '팀 이름은 필수입니다.' });
  }

  const db = getDatabase();
  
  // 중복 팀명 확인
  db.get('SELECT id FROM teams WHERE name = ?', [name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }
    
    if (row) {
      return res.status(409).json({ error: '이미 존재하는 팀 이름입니다.' });
    }

    db.run(
      'INSERT INTO teams (name, description) VALUES (?, ?)',
      [name, description || ''],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '팀 생성 중 오류가 발생했습니다.' });
        }
        
        res.status(201).json({ 
          success: true, 
          team: { 
            id: this.lastID, 
            name, 
            description: description || '' 
          } 
        });
      }
    );
  });
});

// 팀 정보 수정 (관리자만)
router.put('/:teamId', authenticateToken, requireAdmin, (req, res) => {
  const teamId = req.params.teamId;
  const { name, description, manager_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '팀 이름은 필수입니다.' });
  }

  const db = getDatabase();
  
  // 중복 팀명 확인 (자신 제외)
  db.get('SELECT id FROM teams WHERE name = ? AND id != ?', [name, teamId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }
    
    if (row) {
      return res.status(409).json({ error: '이미 존재하는 팀 이름입니다.' });
    }

    db.run(
      'UPDATE teams SET name = ?, description = ?, manager_id = ? WHERE id = ?',
      [name, description || '', manager_id || null, teamId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '팀 정보 수정 중 오류가 발생했습니다.' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
        }
        
        res.json({ success: true, message: '팀 정보가 수정되었습니다.' });
      }
    );
  });
});

// 팀 삭제 (관리자만)
router.delete('/:teamId', authenticateToken, requireAdmin, (req, res) => {
  const teamId = req.params.teamId;
  const db = getDatabase();
  
  // 팀에 속한 멤버가 있는지 확인
  db.get('SELECT COUNT(*) as count FROM users WHERE team_id = ?', [teamId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }
    
    if (row.count > 0) {
      return res.status(409).json({ error: '팀에 속한 멤버가 있어서 삭제할 수 없습니다.' });
    }

    db.run('DELETE FROM teams WHERE id = ?', [teamId], function(err) {
      if (err) {
        return res.status(500).json({ error: '팀 삭제 중 오류가 발생했습니다.' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
      }
      
      res.json({ success: true, message: '팀이 삭제되었습니다.' });
    });
  });
});

// 특정 팀의 멤버 조회
router.get('/:teamId/members', authenticateToken, (req, res) => {
  const teamId = req.params.teamId;
  
  // 권한 확인 (관리자 또는 해당 팀의 팀장/멤버)
  if (req.user.role !== 'admin' && req.user.team_id !== parseInt(teamId)) {
    return res.status(403).json({ error: '접근 권한이 없습니다.' });
  }

  const db = getDatabase();
  db.all(
    `SELECT id, username, name, email, role, created_at
     FROM users 
     WHERE team_id = ? 
     ORDER BY role DESC, name`,
    [teamId],
    (err, members) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      res.json({ success: true, members });
    }
  );
});

module.exports = router;