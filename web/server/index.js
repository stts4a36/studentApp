import express from 'express'
import cors from 'cors'
import os from 'os'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { initDB } from './db.js'
import userRoutes from './routes/user.js'
import meetRoutes from './routes/meet.js'
import newsRoutes from './routes/news.js'
import adminRoutes from './routes/admin.js'
import workRoutes from './routes/work.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

// Initialize database
initDB()

// Routes
app.use('/api/user', userRoutes)
app.use('/api/meet', meetRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/work', workRoutes)

const distDir = join(__dirname, '../client/dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(join(distDir, 'index.html'))
  })
}

function lanUrls(port) {
  const urls = [`http://localhost:${port}`]
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}`)
    }
  }
  return urls
}

const PORT = Number(process.env.PORT || 4000)
const HOST = process.env.HOST || '0.0.0.0'
app.listen(PORT, HOST, () => {
  console.log('StudyAppt web is running:')
  for (const url of lanUrls(PORT)) console.log(`  ${url}`)
  if (!existsSync(distDir)) {
    console.log('Frontend build not found. Run: npm --prefix ../client run build')
  }
})
