const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDatabase } = require('../models/database');
const { authenticateToken, checkTeamAccess } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 계획 목록 조회
router.get('/', checkTeamAccess, (req, res) => {
  const { date, type, user_id } = req.query;
  const targetUserId = user_id || req.user.id;
  
  let query = `
    SELECT p.*, u.name as user_name 
    FROM plans p 
    JOIN users u ON p.user_id = u.id 
    WHERE 1=1
  `;
  const params = [];

  // 사용자별 필터링
  if (targetUserId && req.user.role !== 'admin') {
    query += ` AND p.user_id = ?`;
    params.push(targetUserId);
  } else if (targetUserId) {
    query += ` AND p.user_id = ?`;
    params.push(targetUserId);
  }

  // 날짜별 필터링
  if (date) {
    if (date.length === 7) { // YYYY-MM 형식
      query += ` AND strftime('%Y-%m', p.plan_date) = ?`;
      params.push(date);
    } else { // YYYY-MM-DD 형식
      query += ` AND p.plan_date = ?`;
      params.push(date);
    }
  }

  // 타입별 필터링
  if (type) {
    query += ` AND p.type = ?`;
    params.push(type);
  }

  query += ` ORDER BY p.plan_date DESC, p.start_time ASC`;

  const db = getDatabase();
  db.all(query, params, (err, plans) => {
    if (err) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }

    res.json({ success: true, plans });
  });
});

// 특정 계획 조회 (PDCA 포함)
router.get('/:id', (req, res) => {
  const planId = req.params.id;
  const db = getDatabase();

  db.get(
    `SELECT p.*, u.name as user_name,
            pr.do_content, pr.check_content, pr.action_content,
            pr.updated_at as pdca_updated_at
     FROM plans p 
     JOIN users u ON p.user_id = u.id 
     LEFT JOIN pdca_records pr ON p.id = pr.plan_id
     WHERE p.id = ?`,
    [planId],
    (err, plan) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!plan) {
        return res.status(404).json({ error: '계획을 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인, 팀장, 관리자)
      if (req.user.role !== 'admin' && 
          req.user.id !== plan.user_id && 
          !(req.user.role === 'manager' && req.user.team_id === plan.team_id)) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }

      res.json({ success: true, plan });
    }
  );
});

// 계획 생성
router.post('/', [
  body('type').isIn(['daily', 'weekly', 'monthly']).withMessage('유효한 계획 타입을 선택해주세요.'),
  body('title').notEmpty().withMessage('제목을 입력해주세요.'),
  body('plan_date').isDate().withMessage('유효한 날짜를 입력해주세요.'),
  body('work_type').optional().isIn(['office', 'field'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const {
    type, title, description, plan_date, 
    start_time, end_time, actual_start_time, actual_end_time,
    work_type, location, is_recurring, parent_plan_id, special_event_type, is_changed_task, status
  } = req.body;

  const db = getDatabase();
  db.run(
    `INSERT INTO plans 
     (user_id, type, title, description, plan_date, start_time, end_time, 
      actual_start_time, actual_end_time, work_type, location, status, is_recurring, parent_plan_id, special_event_type, is_changed_task) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id, type, title, description, plan_date,
      start_time || (is_changed_task ? null : '09:00'), 
      end_time || (is_changed_task ? null : '17:00'),
      actual_start_time || null, actual_end_time || null,
      work_type || 'office', location, 
      status || 'planned', is_recurring || false, parent_plan_id || null, special_event_type || null, is_changed_task || false
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '계획 생성에 실패했습니다.' });
      }

      res.status(201).json({ 
        success: true, 
        message: '계획이 생성되었습니다.',
        plan: { id: this.lastID }
      });
    }
  );
});

// 계획 수정
router.put('/:id', [
  body('title').optional().notEmpty().withMessage('제목을 입력해주세요.'),
  body('plan_date').optional().isDate().withMessage('유효한 날짜를 입력해주세요.')
], (req, res) => {
  const planId = req.params.id;
  const updates = req.body;
  
  // 수정 가능한 필드만 허용
  const allowedFields = [
    'title', 'description', 'plan_date', 'start_time', 'end_time',
    'actual_start_time', 'actual_end_time', 'work_type', 'location', 'status', 'special_event_type', 'is_changed_task'
  ];
  
  const updateFields = [];
  const updateValues = [];
  
  Object.keys(updates).forEach(field => {
    if (allowedFields.includes(field)) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updates[field]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: '수정할 필드가 없습니다.' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(planId, req.user.id);

  const db = getDatabase();
  db.run(
    `UPDATE plans SET ${updateFields.join(', ')} 
     WHERE id = ? AND user_id = ?`,
    updateValues,
    function(err) {
      if (err) {
        return res.status(500).json({ error: '계획 수정에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '계획을 찾을 수 없거나 수정 권한이 없습니다.' });
      }

      res.json({ success: true, message: '계획이 수정되었습니다.' });
    }
  );
});

// 계획 복사
router.post('/:id/copy', [
  body('target_dates').isArray().withMessage('복사할 날짜 목록을 제공해주세요.'),
  body('copy_pdca').optional().isBoolean()
], (req, res) => {
  const planId = req.params.id;
  const { target_dates, copy_pdca = false } = req.body;

  const db = getDatabase();
  
  // 원본 계획 조회
  db.get(
    `SELECT * FROM plans WHERE id = ? AND user_id = ?`,
    [planId, req.user.id],
    (err, originalPlan) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!originalPlan) {
        return res.status(404).json({ error: '계획을 찾을 수 없습니다.' });
      }

      // 각 날짜별로 복사
      const copyPromises = target_dates.map(date => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO plans 
             (user_id, type, title, description, plan_date, start_time, end_time, 
              work_type, location, parent_plan_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              originalPlan.user_id, originalPlan.type, originalPlan.title,
              originalPlan.description, date, originalPlan.start_time,
              originalPlan.end_time, originalPlan.work_type, originalPlan.location,
              originalPlan.id
            ],
            function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            }
          );
        });
      });

      Promise.all(copyPromises)
        .then(() => {
          res.json({ 
            success: true, 
            message: `${target_dates.length}개 날짜로 계획이 복사되었습니다.` 
          });
        })
        .catch(err => {
          res.status(500).json({ error: '계획 복사에 실패했습니다.' });
        });
    }
  );
});

// 계획 삭제
router.delete('/:id', (req, res) => {
  const planId = req.params.id;
  const db = getDatabase();

  db.run(
    `DELETE FROM plans WHERE id = ? AND user_id = ?`,
    [planId, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '계획 삭제에 실패했습니다.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '계획을 찾을 수 없거나 삭제 권한이 없습니다.' });
      }

      res.json({ success: true, message: '계획이 삭제되었습니다.' });
    }
  );
});

// PDCA 기록 저장/수정
router.post('/:id/pdca', [
  body('do_content').optional(),
  body('check_content').optional(),
  body('action_content').optional()
], (req, res) => {
  const planId = req.params.id;
  const { do_content, check_content, action_content } = req.body;

  const db = getDatabase();
  
  // 먼저 계획 존재 및 권한 확인
  db.get(
    `SELECT user_id FROM plans WHERE id = ?`,
    [planId],
    (err, plan) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!plan) {
        return res.status(404).json({ error: '계획을 찾을 수 없습니다.' });
      }

      if (plan.user_id !== req.user.id) {
        return res.status(403).json({ error: 'PDCA 기록 권한이 없습니다.' });
      }

      // 기존 PDCA 기록 확인
      db.get(
        `SELECT id FROM pdca_records WHERE plan_id = ?`,
        [planId],
        (err, existingRecord) => {
          if (err) {
            return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
          }

          if (existingRecord) {
            // 기존 기록 업데이트
            db.run(
              `UPDATE pdca_records 
               SET do_content = ?, check_content = ?, action_content = ?, 
                   updated_at = CURRENT_TIMESTAMP
               WHERE plan_id = ?`,
              [do_content, check_content, action_content, planId],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'PDCA 기록 수정에 실패했습니다.' });
                }

                res.json({ success: true, message: 'PDCA 기록이 수정되었습니다.' });
              }
            );
          } else {
            // 새 기록 생성
            db.run(
              `INSERT INTO pdca_records (plan_id, do_content, check_content, action_content) 
               VALUES (?, ?, ?, ?)`,
              [planId, do_content, check_content, action_content],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'PDCA 기록 저장에 실패했습니다.' });
                }

                res.status(201).json({ 
                  success: true, 
                  message: 'PDCA 기록이 저장되었습니다.',
                  recordId: this.lastID 
                });
              }
            );
          }
        }
      );
    }
  );
});

// PDCA 기록 조회
router.get('/:id/pdca', (req, res) => {
  const planId = req.params.id;
  const db = getDatabase();

  db.get(
    `SELECT pr.*, p.user_id
     FROM pdca_records pr
     JOIN plans p ON pr.plan_id = p.id
     WHERE pr.plan_id = ?`,
    [planId],
    (err, record) => {
      if (err) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
      }

      if (!record) {
        return res.status(404).json({ error: 'PDCA 기록을 찾을 수 없습니다.' });
      }

      // 권한 확인 (본인, 팀장, 관리자)
      if (req.user.role !== 'admin' && 
          req.user.id !== record.user_id && 
          req.user.role !== 'manager') {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }

      res.json({ success: true, record });
    }
  );
});

// 주간 보고서 데이터 조회
router.get('/report/weekly', (req, res) => {
  const { date } = req.query; // YYYY-MM-DD 형식의 주 시작일
  const userId = req.user.id;
  
  if (!date) {
    return res.status(400).json({ error: '날짜 파라미터가 필요합니다.' });
  }

  const db = getDatabase();
  
  // 주어진 날짜의 주 시작일과 종료일 계산
  const startDate = new Date(date);
  const dayOfWeek = startDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 일요일이면 -6, 아니면 1-dayOfWeek
  
  const monday = new Date(startDate);
  monday.setDate(monday.getDate() + mondayOffset);
  
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  
  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  // 이번 주 PDCA 데이터 조회 (daily 타입만)
  const thisWeekQuery = `
    SELECT p.*, 
           pr.do_content, pr.check_content, pr.action_content,
           strftime('%w', p.plan_date) as day_of_week
    FROM plans p 
    LEFT JOIN pdca_records pr ON p.id = pr.plan_id
    WHERE p.user_id = ? 
    AND p.plan_date BETWEEN ? AND ?
    AND p.type = 'daily'
    ORDER BY p.plan_date ASC, 
             CASE 
               WHEN p.start_time IS NULL AND p.actual_start_time IS NOT NULL 
               THEN p.actual_start_time 
               ELSE COALESCE(p.start_time, '23:59') 
             END ASC
  `;

  // 다음 주 계획 데이터 조회 (daily 타입만)
  const nextMondayStr = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextSundayStr = new Date(sunday.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const nextWeekQuery = `
    SELECT p.*, strftime('%w', p.plan_date) as day_of_week
    FROM plans p 
    WHERE p.user_id = ? 
    AND p.plan_date BETWEEN ? AND ?
    AND p.type = 'daily'
    AND p.status != 'cancelled'
    ORDER BY p.plan_date ASC, 
             CASE 
               WHEN p.start_time IS NULL AND p.actual_start_time IS NOT NULL 
               THEN p.actual_start_time 
               ELSE COALESCE(p.start_time, '23:59') 
             END ASC
  `;

  // 이번 달 주요 계획 조회 (monthly 타입)
  const currentMonth = date.substring(0, 7); // YYYY-MM
  const monthlyQuery = `
    SELECT * FROM plans 
    WHERE user_id = ? 
    AND type = 'monthly'
    AND strftime('%Y-%m', plan_date) = ?
    AND status != 'cancelled'
    ORDER BY plan_date ASC
  `;

  // 이번 주 주요 계획 조회 (weekly 타입)
  const weeklyQuery = `
    SELECT * FROM plans 
    WHERE user_id = ? 
    AND type = 'weekly'
    AND plan_date BETWEEN ? AND ?
    AND status != 'cancelled'
    ORDER BY plan_date ASC
  `;

  // 다음 주 주요 계획 조회 (weekly 타입)
  const nextWeeklyQuery = `
    SELECT * FROM plans 
    WHERE user_id = ? 
    AND type = 'weekly'
    AND plan_date BETWEEN ? AND ?
    AND status != 'cancelled'
    ORDER BY plan_date ASC
  `;

  // 모든 쿼리 실행
  Promise.all([
    new Promise((resolve, reject) => {
      db.all(thisWeekQuery, [userId, mondayStr, sundayStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(nextWeekQuery, [userId, nextMondayStr, nextSundayStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(monthlyQuery, [userId, currentMonth], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(weeklyQuery, [userId, mondayStr, sundayStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(nextWeeklyQuery, [userId, nextMondayStr, nextSundayStr], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  ])
  .then(([thisWeekPlans, nextWeekPlans, monthlyPlans, weeklyPlans, nextWeeklyPlans]) => {
    res.json({
      success: true,
      data: {
        thisWeek: thisWeekPlans,
        nextWeek: nextWeekPlans,
        monthlyMajor: monthlyPlans,
        weeklyMajor: weeklyPlans,
        nextWeeklyMajor: nextWeeklyPlans,
        dateRange: {
          thisWeekStart: mondayStr,
          thisWeekEnd: sundayStr,
          nextWeekStart: nextMondayStr,
          nextWeekEnd: nextSundayStr
        }
      }
    });
  })
  .catch(err => {
    console.error('Weekly report query error:', err);
    res.status(500).json({ error: '보고서 데이터 조회에 실패했습니다.' });
  });
});

module.exports = router;