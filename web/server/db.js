import { createClient } from '@libsql/client'
import { fileURLToPath, pathToFileURL } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { backfillColorIndexes } from './colorIndex.js'

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
      USER_USERNAME TEXT UNIQUE,
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

    CREATE TABLE IF NOT EXISTS meet_people (
      MEET_ID TEXT NOT NULL,
      USER_ID TEXT NOT NULL,
      ROLE TEXT NOT NULL,
      PRIMARY KEY (MEET_ID, USER_ID)
    );

    CREATE TABLE IF NOT EXISTS notices (
      NOTICE_ID TEXT PRIMARY KEY,
      NOTICE_USER_ID TEXT,
      NOTICE_TITLE TEXT,
      NOTICE_BODY TEXT DEFAULT '',
      NOTICE_MEET_ID TEXT DEFAULT '',
      NOTICE_READ INTEGER DEFAULT 0,
      NOTICE_ADD_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS meet_logs (
      LOG_ID TEXT PRIMARY KEY,
      MEET_ID TEXT,
      ACTOR_NAME TEXT DEFAULT '',
      ACTION TEXT DEFAULT '',
      DETAIL TEXT DEFAULT '',
      ADD_TIME INTEGER
    );

    CREATE TABLE IF NOT EXISTS fee_groups (
      GROUP_ID TEXT PRIMARY KEY,
      GROUP_NAME TEXT NOT NULL,
      GROUP_ORDER INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meet_group_prices (
      MEET_ID TEXT NOT NULL,
      GROUP_ID TEXT NOT NULL,
      PRICE REAL,
      PRIMARY KEY (MEET_ID, GROUP_ID)
    );

    CREATE TABLE IF NOT EXISTS private_events (
      EVENT_ID TEXT PRIMARY KEY,
      OWNER_USER_ID TEXT DEFAULT '',
      OWNER_ADMIN_ID TEXT DEFAULT '',
      TITLE TEXT NOT NULL,
      ALL_DAY INTEGER DEFAULT 0,
      START_DAY TEXT NOT NULL,
      START_TIME TEXT DEFAULT '',
      END_DAY TEXT NOT NULL,
      END_TIME TEXT DEFAULT '',
      LOCATION TEXT DEFAULT '',
      LINK TEXT DEFAULT '',
      NOTE TEXT DEFAULT '',
      REPEAT_RULE TEXT DEFAULT '',
      MULTI_DAY INTEGER DEFAULT 0,
      COLOR_INDEX INTEGER DEFAULT 0,
      ADD_TIME INTEGER,
      EDIT_TIME INTEGER
    );
  `)

  const admin = await db.prepare('SELECT * FROM admins WHERE ADMIN_NAME = ?').get('admin')
  if (!admin) {
    const hash = bcrypt.hashSync('123456', 10)
    await db.prepare('INSERT INTO admins (ADMIN_ID, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_STATUS, ADMIN_TYPE, ADMIN_ADD_TIME) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), 'admin', hash, 1, 1, Date.now())
  } else {
    await db.prepare('UPDATE admins SET ADMIN_TYPE = 1 WHERE ADMIN_NAME = ?').run('admin')
  }

  const groupSeeds = [
    ['中四', 1],
    ['中五', 2],
    ['中六', 3],
    ['大學生', 4],
  ]
  for (const [name, order] of groupSeeds) {
    const exists = await db.prepare('SELECT GROUP_ID FROM fee_groups WHERE GROUP_NAME = ?').get(name)
    if (!exists) {
      await db.prepare('INSERT INTO fee_groups (GROUP_ID, GROUP_NAME, GROUP_ORDER) VALUES (?, ?, ?)').run(uuidv4(), name, order)
    }
  }

  for (const sql of [
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER TEXT DEFAULT ""',
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER_ID TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_USERNAME TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_ENROLL_YEAR TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_ENROLL_GRADE TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_CURRENT_GRADE TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_SCHOOL_STATUS TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_AVATAR TEXT DEFAULT ""',
    'ALTER TABLE meets ADD COLUMN MEET_IS_PUBLIC INTEGER DEFAULT 1',
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER_VIEW INTEGER DEFAULT 1',
    'ALTER TABLE meets ADD COLUMN MEET_TEACHER_EDIT INTEGER DEFAULT 1',
    'ALTER TABLE meets ADD COLUMN MEET_CUTOFF_HOURS INTEGER DEFAULT 24',
    'ALTER TABLE meets ADD COLUMN MEET_JOIN_CUTOFF_HOURS INTEGER DEFAULT 24',
    'ALTER TABLE meets ADD COLUMN MEET_CANCEL_HOURS INTEGER DEFAULT 24',
    'ALTER TABLE meets ADD COLUMN MEET_DESC TEXT DEFAULT ""',
    'ALTER TABLE meets ADD COLUMN MEET_COVER TEXT DEFAULT ""',
    'ALTER TABLE meets ADD COLUMN MEET_DEFAULT_LIMIT INTEGER DEFAULT 5',
    'ALTER TABLE users ADD COLUMN USER_COLOR_INDEX INTEGER',
    'ALTER TABLE meets ADD COLUMN MEET_COLOR_INDEX INTEGER',
    'ALTER TABLE users ADD COLUMN USER_GROUP_ID TEXT DEFAULT ""',
    'ALTER TABLE joins ADD COLUMN JOIN_CREDIT REAL DEFAULT 1',
    'ALTER TABLE admins ADD COLUMN ADMIN_TYPE INTEGER DEFAULT 0',
    'ALTER TABLE users ADD COLUMN USER_PHONE TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_EMAIL TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_IG TEXT DEFAULT ""',
    'ALTER TABLE users ADD COLUMN USER_NOTE TEXT DEFAULT ""',
  ]) {
    try { await getClient().execute(sql) } catch {}
  }

  try { await getClient().execute('UPDATE meets SET MEET_IS_PUBLIC = 1 WHERE MEET_IS_PUBLIC IS NULL') } catch {}

  try {
    await getClient().execute('ALTER TABLE meets ADD COLUMN MEET_STUDENT_VIEW INTEGER DEFAULT 1')
    await getClient().execute('UPDATE meets SET MEET_STUDENT_VIEW = COALESCE(MEET_IS_PUBLIC, 1)')
  } catch {}
  try {
    await getClient().execute('ALTER TABLE meets ADD COLUMN MEET_STUDENT_EDIT INTEGER DEFAULT 1')
    await getClient().execute('UPDATE meets SET MEET_STUDENT_EDIT = CASE WHEN COALESCE(MEET_IS_PUBLIC, 1) = 0 THEN 0 ELSE 1 END')
  } catch {}

  await getClient().execute(`
    UPDATE users
    SET USER_USERNAME = USER_MOBILE
    WHERE (USER_USERNAME IS NULL OR USER_USERNAME = '')
      AND USER_MOBILE IS NOT NULL AND USER_MOBILE != ''
  `)

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

  await getClient().execute(`
    INSERT OR IGNORE INTO meet_people (MEET_ID, USER_ID, ROLE)
    SELECT MEET_ID, MEET_TEACHER_ID, 'teacher'
    FROM meets
    WHERE MEET_TEACHER_ID IS NOT NULL AND MEET_TEACHER_ID != ''
  `)

  try { await getClient().execute('UPDATE joins SET JOIN_CREDIT = 1 WHERE JOIN_CREDIT IS NULL') } catch {}

  await backfillColorIndexes(db)
}

export default db
