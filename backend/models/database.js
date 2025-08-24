const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './database/pdca.db');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('데이터베이스 연결 실패:', err.message);
        reject(err);
      } else {
        console.log('SQLite 데이터베이스에 연결되었습니다.');
        createTables(db)
          .then(() => createDefaultAdmin(db))
          .then(() => createDefaultTeams(db))
          .then(() => {
            console.log('데이터베이스 초기화 완료');
            resolve(db);
          })
          .catch(reject);
      }
    });
  });
}

function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Teams 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          manager_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (manager_id) REFERENCES users(id)
        )
      `);

      // Users 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100),
          role TEXT CHECK(role IN ('member', 'manager', 'admin')) DEFAULT 'member',
          team_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id)
        )
      `);

      // Plans 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT CHECK(type IN ('daily', 'weekly', 'monthly')) NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          plan_date DATE NOT NULL,
          start_time TIME DEFAULT '09:00',
          end_time TIME DEFAULT '17:00',
          actual_start_time TIME,
          actual_end_time TIME,
          work_type TEXT CHECK(work_type IN ('office', 'field')) DEFAULT 'office',
          location TEXT,
          status TEXT CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'planned',
          is_recurring BOOLEAN DEFAULT FALSE,
          parent_plan_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (parent_plan_id) REFERENCES plans(id)
        )
      `);

      // PDCA Records 테이블 생성
      db.run(`
        CREATE TABLE IF NOT EXISTS pdca_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER NOT NULL,
          do_content TEXT,
          check_content TEXT,
          action_content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          // 인덱스 생성
          db.run(`CREATE INDEX IF NOT EXISTS idx_plans_user_date ON plans(user_id, plan_date)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(plan_date)`);
          db.run(`CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id)`);
          
          // 기존 데이터베이스에 actual time 컬럼 추가 (마이그레이션)
          db.run(`ALTER TABLE plans ADD COLUMN actual_start_time TIME`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('actual_start_time 컬럼 추가 실패:', err.message);
            }
          });
          db.run(`ALTER TABLE plans ADD COLUMN actual_end_time TIME`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('actual_end_time 컬럼 추가 실패:', err.message);
            }
          });
          
          resolve();
        }
      });
    });
  });
}

async function createDefaultAdmin(db) {
  return new Promise((resolve, reject) => {
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 12);
    
    db.get("SELECT id FROM users WHERE username = ?", [process.env.ADMIN_USERNAME || 'admin'], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        db.run(`
          INSERT INTO users (username, password, name, email, role)
          VALUES (?, ?, ?, ?, 'admin')
        `, [
          process.env.ADMIN_USERNAME || 'admin',
          hashedPassword,
          process.env.ADMIN_NAME || '관리자',
          process.env.ADMIN_EMAIL || 'admin@company.com'
        ], (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('기본 관리자 계정이 생성되었습니다.');
            resolve();
          }
        });
      } else {
        console.log('관리자 계정이 이미 존재합니다.');
        resolve();
      }
    });
  });
}

async function createDefaultTeams(db) {
  return new Promise((resolve, reject) => {
    const defaultTeams = [
      { name: 'EDA', description: 'EDA 팀' },
      { name: 'PADS', description: 'PADS 팀' },
      { name: 'ADSK', description: 'ADSK 팀' },
      { name: 'MANAGE', description: 'MANAGE 팀' }
    ];

    let completed = 0;
    const total = defaultTeams.length;

    defaultTeams.forEach(team => {
      db.get("SELECT id FROM teams WHERE name = ?", [team.name], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          db.run(`
            INSERT INTO teams (name, description)
            VALUES (?, ?)
          `, [team.name, team.description], (err) => {
            if (err) {
              reject(err);
            } else {
              console.log(`기본 팀 '${team.name}'이 생성되었습니다.`);
              completed++;
              if (completed === total) {
                resolve();
              }
            }
          });
        } else {
          console.log(`팀 '${team.name}'이 이미 존재합니다.`);
          completed++;
          if (completed === total) {
            resolve();
          }
        }
      });
    });
  });
}

function getDatabase() {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('데이터베이스 연결 실패:', err.message);
      throw err;
    }
  });
}

// 직접 실행시 데이터베이스 초기화
if (require.main === module) {
  initializeDatabase()
    .then((db) => {
      db.close();
      console.log('데이터베이스 초기화가 완료되었습니다.');
    })
    .catch((err) => {
      console.error('데이터베이스 초기화 실패:', err);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, getDatabase };