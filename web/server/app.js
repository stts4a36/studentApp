import express from 'express'
import cors from 'cors'
import { initDB } from './db.js'
import userRoutes from './routes/user.js'
import meetRoutes from './routes/meet.js'
import newsRoutes from './routes/news.js'
import adminRoutes from './routes/admin.js'
import workRoutes from './routes/work.js'

const app = express()
app.use(cors())
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return next()
  }
  express.json()(req, res, next)
})

app.use((req, _res, next) => {
  if (process.env.VERCEL && !req.path.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`
  }
  next()
})

let ready
export function ensureDB() {
  if (!ready) ready = initDB()
  return ready
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasTurso: Boolean(process.env.TURSO_DATABASE_URL),
  })
})

app.use(async (_req, _res, next) => {
  try {
    await ensureDB()
    next()
  } catch (err) {
    next(err)
  }
})

app.use('/api/user', userRoutes)
app.use('/api/meet', meetRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/work', workRoutes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ msg: err.message || '伺服器錯誤' })
})

export default app
