import { createClient } from '@libsql/client'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createDbClient() {
  const url = process.env.TURSO_DATABASE_URL
  if (url) {
    return createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
      intMode: 'number',
    })
  }
  if (process.env.VERCEL) {
    throw new Error('Vercel 部署必須設定 TURSO_DATABASE_URL 與 TURSO_AUTH_TOKEN')
  }
  return createClient({
    url: pathToFileURL(join(__dirname, 'data.db')).href,
    intMode: 'number',
  })
}

let client
function getClient() {
  if (!client) client = createDbClient()
  return client
}

function asArgs(args) {
  return args.length === 1 && Array.isArray(args[0]) ? args[0] : args
}

function prepare(sql) {
  return {
    get: async (...args) => {
      const result = await getClient().execute({ sql, args: asArgs(args) })
      return result.rows[0]
    },
    all: async (...args) => {
      const result = await getClient().execute({ sql, args: asArgs(args) })
      return result.rows
    },
    run: async (...args) => {
      const result = await getClient().execute({ sql, args: asArgs(args) })
      return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid }
    },
  }
}

const db = {
  prepare,
  get client() {
    return getClient()
  },
}

export async function initDB() {
  await getClient().executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      USER_ID TEXT PRIMARY KEY,
      USER_NAME TEXT,
      USER_MOBILE TEXT UNIQUE,
      USER_PASSWORD TEXT,
      USER_STATUS INTEGER DEFAULT 1,
      USER_TYPE INTEGER DEFAULT 1,
      USER_LESSON_TOTAL_CNT INTEGER DEFAULT 0,
      USER_LESSON_USED_CNT INTEGER DEFAULT 0,
      USER_LOGIN_CNT INTEGER DEFAULT 0,
      USER_LOGIN_TIME INTEGER DEFAULT 0,
      USER_FORMS TEXT DEFAULT '[]',
      USER_OBJ TEXT DEFAULT '{}',
      USER_ENROLL_YEAR TEXT DEFAULT '',
      USER_ENROLL_GRADE TEXT DEFAULT '',
      USER_CURRENT_GRADE TEXT DEFAULT '',
      USER_SCHOOL_STATUS TEXT DEFAULT '',
      USER_ADD_TIME INTEGER,
      USER_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS admins (
      ADMIN_ID TEXT PRIMARY KEY,
      ADMIN_NAME TEXT UNIQUE,
      ADMIN_PASSWORD TEXT,
      ADMIN_STATUS INTEGER DEFAULT 1,
      ADMIN_TYPE INTEGER DEFAULT 0,
      ADMIN_ADD_TIME INTEGER,
      ADMIN_LOGIN_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS meets (
      MEET_ID TEXT PRIMARY KEY,
      MEET_ADMIN_ID TEXT,
      MEET_TITLE TEXT,
      MEET_TEACHER TEXT DEFAULT '',
      MEET_TEACHER_ID TEXT DEFAULT '',
      MEET_CATE_ID TEXT DEFAULT '',
      MEET_CATE_NAME TEXT DEFAULT '',
      MEET_JOIN_FORMS TEXT DEFAULT '[]',
      MEET_DAYS TEXT DEFAULT '[]',
      MEET_FORMS TEXT DEFAULT '[]',
      MEET_OBJ TEXT DEFAULT '{}',
      MEET_CANCEL_SET INTEGER DEFAULT 1,
      MEET_STATUS INTEGER DEFAULT 1,
      MEET_ORDER INTEGER DEFAULT 9999,
      MEET_VOUCH INTEGER DEFAULT 0,
      MEET_PHONE TEXT,
      MEET_PASSWORD TEXT,
      MEET_LOGIN_CNT INTEGER DEFAULT 0,
      MEET_LOGIN_TIME INTEGER,
      MEET_ADD_TIME INTEGER,
      MEET_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS days (
      DAY_ID TEXT PRIMARY KEY,
      DAY_MEET_ID TEXT,
      day TEXT,
      dayDesc TEXT DEFAULT '',
      times TEXT DEFAULT '[]',
      DAY_ADD_TIME INTEGER,
      DAY_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS joins (
      JOIN_ID TEXT PRIMARY KEY,
      JOIN_USER_ID TEXT,
      JOIN_MEET_ID TEXT,
      JOIN_MEET_CATE_ID TEXT DEFAULT '',
      JOIN_MEET_CATE_NAME TEXT DEFAULT '',
      JOIN_MEET_TITLE TEXT,
      JOIN_MEET_DAY TEXT,
      JOIN_MEET_TIME_START TEXT,
      JOIN_MEET_TIME_END TEXT,
      JOIN_MEET_TIME_MARK TEXT,
      JOIN_CODE TEXT,
      JOIN_IS_CHECKIN INTEGER DEFAULT 0,
      JOIN_CHECKIN_TIME INTEGER DEFAULT 0,
      JOIN_IS_ADMIN INTEGER DEFAULT 0,
      JOIN_STATUS INTEGER DEFAULT 1,
      JOIN_REASON TEXT DEFAULT '',
      JOIN_FORMS TEXT DEFAULT '[]',
      JOIN_OBJ TEXT DEFAULT '{}',
      JOIN_START_TIME INTEGER,
      JOIN_ADD_TIME INTEGER,
      JOIN_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS news (
      NEWS_ID TEXT PRIMARY KEY,
      NEWS_TITLE TEXT,
      NEWS_DESC TEXT DEFAULT '',
      NEWS_STATUS INTEGER DEFAULT 1,
      NEWS_CATE_ID TEXT DEFAULT '',
      NEWS_CATE_NAME TEXT DEFAULT '',
      NEWS_ORDER INTEGER DEFAULT 9999,
      NEWS_VOUCH INTEGER DEFAULT 0,
      NEWS_CONTENT TEXT DEFAULT '[]',
      NEWS_VIEW_CNT INTEGER DEFAULT 0,
      NEWS_PIC TEXT DEFAULT '[]',
      NEWS_FORMS TEXT DEFAULT '[]',
      NEWS_OBJ TEXT DEFAULT '{}',
      NEWS_ADD_TIME INTEGER,
      NEWS_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS lesson_logs (
      LESSON_LOG_ID TEXT PRIMARY KEY,
      LESSON_LOG_USER_ID TEXT,
      LESSON_LOG_MEET_ID TEXT,
      LESSON_LOG_DESC TEXT DEFAULT '',
      LESSON_LOG_TYPE INTEGER DEFAULT 0,
      LESSON_LOG_CHANGE_CNT INTEGER DEFAULT 0,
      LESSON_LOG_LAST_CNT INTEGER DEFAULT 0,
      LESSON_LOG_NOW_CNT INTEGER DEFAULT 0,
      LESSON_LOG_EDIT_ADMIN_ID TEXT,
      LESSON_LOG_EDIT_ADMIN_NAME TEXT,
      LESSON_LOG_ADD_TIME INTEGER,
      LESSON_LOG_EDIT_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS favs (
      FAV_ID TEXT PRIMARY KEY,
      FAV_USER_ID TEXT,
      FAV_TITLE TEXT,
      FAV_TYPE TEXT,
      FAV_OID TEXT,
      FAV_PATH TEXT,
      FAV_ADD_TIME INTEGER
    );
  `)

  const admin = await db.prepare('SELECT * FROM admins WHERE ADMIN_NAME = ?').get('admin')
  if (!admin) {
    const hash = bcrypt.hashSync('123456', 10)
    await db.prepare('INSERT INTO admins (ADMIN_ID, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_STATUS, ADMIN_ADD_TIME) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'admin', hash, 1, Date.now())
  }

  for (const sql of [
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER TEXT DEFAULT ""',
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER_ID TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_ENROLL_YEAR TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_ENROLL_GRADE TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_CURRENT_GRADE TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_SCHOOL_STATUS TEXT DEFAULT ""',
  ]) {
    try { await getClient().execute(sql) } catch {}
  }

  const unbound = await db.prepare(`
    SELECT MEET_ID, MEET_TEACHER FROM meets
    WHERE (MEET_TEACHER_ID IS NULL OR MEET_TEACHER_ID = '') AND MEET_TEACHER != ''
  `).all()
  for (const row of unbound) {
    const teacher = await db.prepare('SELECT USER_ID FROM users WHERE USER_NAME = ? AND USER_TYPE = 2').get(row.MEET_TEACHER)
    if (teacher) {
      await db.prepare('UPDATE meets SET MEET_TEACHER_ID = ? WHERE MEET_ID = ?').run(teacher.USER_ID, row.MEET_ID)
    }
  }
}

export default db
