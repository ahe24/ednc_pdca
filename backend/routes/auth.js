const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 로그인
router.post('/login', [
  body('username').notEmpty().withMessage('사용자명을 입력해주세요.'),
  body('password').notEmpty().withMessage('비밀번호를 입력해주세요.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { username, password } = req.body;
  const db = getDatabase();

  db.get(
    `SELECT u.*, t.name as team_name 
     FROM users u 
     LEFT JOIN teams t ON u.team_id = t.id 
     WHERE u.username = ?`,
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '데이터베이스 오류가 발생했습니다.' 
        });
      }

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ 
          success: false, 
          error: '사용자명 또는 비밀번호가 올바르지 않습니다.' 
        });
      }

      // JWT 토큰 생성
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          team_id: user.team_id 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      // httpOnly 쿠키로 토큰 설정
      res.cookie('token', token, {
        httpOnly: true,
        secure: false, // development에서는 false
        sameSite: 'lax', // strict에서 lax로 변경
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30일
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          team_id: user.team_id,
          team_name: user.team_name
        }
      });
    }
  );
});

// 로그아웃
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  });
  res.json({ success: true, message: '로그아웃되었습니다.' });
});

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get(
    `SELECT u.id, u.username, u.name, u.email, u.role, u.team_id, t.name as team_name
     FROM users u 
     LEFT JOIN teams t ON u.team_id = t.id 
     WHERE u.id = ?`,
    [req.user.id],
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
});

// 토큰 검증
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ success: true, valid: true, user: req.user });
});

// 프로필 수정 (이름, 이메일)
router.put('/profile', [
  authenticateToken,
  body('name').notEmpty().withMessage('이름을 입력해주세요.'),
  body('email').optional().isEmail().withMessage('유효한 이메일 주소를 입력해주세요.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { name, email } = req.body;
  const db = getDatabase();

  db.run(
    `UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, email, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      }

      res.json({ success: true, message: '프로필이 수정되었습니다.' });
    }
  );
});

// 비밀번호 변경
router.put('/password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('현재 비밀번호를 입력해주세요.'),
  body('newPassword').isLength({ min: 6 }).withMessage('새 비밀번호는 최소 6자 이상이어야 합니다.')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { currentPassword, newPassword } = req.body;
  const db = getDatabase();

  // 현재 비밀번호 확인
  db.get(
    `SELECT password FROM users WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      }

      // 새 비밀번호 해시화 및 저장
      const hashedNewPassword = bcrypt.hashSync(newPassword, 12);
      
      db.run(
        `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [hashedNewPassword, req.user.id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
          }

          res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
        }
      );
    }
  );
});

module.exports = router;