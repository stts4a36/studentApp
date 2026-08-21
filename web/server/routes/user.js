import { Router } from '../router.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authWork, signUserToken, signWorkToken } from '../middleware.js'
import { persistAcademic, refreshAcademic } from '../studentAcademic.js'
import { findUserByLogin, isValidUsername, normalizeUsername, usernameTaken } from '../username.js'
import { avatarPublicPath, avatarUpload } from '../avatar.js'

const router = Router()

// Register
router.post('/register', async (req, res) => {
  const { name, username, mobile, password, enrollYear, enrollGrade, currentGrade } = req.body
  const login = normalizeUsername(username || mobile)
  if (!name || !login || !password) return res.status(400).json({ msg: '請填寫完整資訊' })
  if (!isValidUsername(login)) return res.status(400).json({ msg: '帳號需為 3–32 字，不可含空白' })
  if (!enrollYear || !enrollGrade || !currentGrade) return res.status(400).json({ msg: '請填寫入學年份、入學年級與現時年級' })

  if (await usernameTaken(db, login)) return res.status(400).json({ msg: '該帳號已被使用' })

  const hash = bcrypt.hashSync(password, 10)
  const userId = uuidv4()
  const now = Date.now()

  await db.prepare(`INSERT INTO users (USER_ID, USER_NAME, USER_USERNAME, USER_PASSWORD, USER_STATUS, USER_TYPE, USER_ADD_TIME, USER_EDIT_TIME)
    VALUES (?, ?, ?, ?, 1, 1, ?, ?)`).run(userId, name, login, hash, now, now)
  await persistAcademic(db, userId, { enrollYear, enrollGrade, currentGrade })

  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(userId)
  delete user.USER_PASSWORD
  const token = signUserToken(userId)
  res.json({ token, user })
})

// Login
router.post('/login', async (req, res) => {
  const login = req.body.username || req.body.mobile || req.body.phone
  const { password } = req.body
  const user = await findUserByLogin(db, login)
  if (!user) return res.status(400).json({ msg: '用戶不存在' })
  if (!bcrypt.compareSync(password, user.USER_PASSWORD)) return res.status(400).json({ msg: '密碼錯誤' })
  if (user.USER_STATUS !== 1) return res.status(400).json({ msg: '帳號已被停用' })

  await db.prepare('UPDATE users SET USER_LOGIN_CNT = USER_LOGIN_CNT + 1, USER_LOGIN_TIME = ? WHERE USER_ID = ?')
    .run(Date.now(), user.USER_ID)

  await refreshAcademic(db, user)
  delete user.USER_PASSWORD
  const token = signUserToken(user.USER_ID)
  const result = { token, user }
  if (user.USER_TYPE === 2) {
    result.workToken = signWorkToken(user.USER_ID, user.USER_NAME)
  }
  res.json(result)
})

// Get my detail
router.get('/my', authWork, async (req, res) => {
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.userId)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })
  await refreshAcademic(db, user)
  delete user.USER_PASSWORD
  res.json({ data: user })
})

router.put('/profile', authWork, async (req, res) => {
  const { name, enrollYear, enrollGrade, currentGrade } = req.body
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.userId)
  if (!user) return res.status(404).json({ msg: '用戶不存在' })
  if (name) {
    await db.prepare('UPDATE users SET USER_NAME = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(name, Date.now(), req.userId)
  }
  if (user.USER_TYPE !== 2) {
    await persistAcademic(db, req.userId, {
      enrollYear: enrollYear ?? user.USER_ENROLL_YEAR,
      enrollGrade: enrollGrade ?? user.USER_ENROLL_GRADE,
      currentGrade: currentGrade ?? user.USER_CURRENT_GRADE,
    })
  }
  const updated = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.userId)
  delete updated.USER_PASSWORD
  res.json({ data: updated })
})

router.post('/avatar', authWork, avatarUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: '請選擇圖片' })
  const path = avatarPublicPath(req.file.filename)
  await db.prepare('UPDATE users SET USER_AVATAR = ?, USER_EDIT_TIME = ? WHERE USER_ID = ?').run(path, Date.now(), req.userId)
  const user = await db.prepare('SELECT * FROM users WHERE USER_ID = ?').get(req.userId)
  delete user.USER_PASSWORD
  res.json({ data: user })
})

export default router
