import { existsSync, mkdirSync } from 'fs'
import os from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import app, { ensureDB } from './app.js'
import { uploadsRoot } from './avatar.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
if (!process.env.VERCEL) {
  mkdirSync(uploadsRoot, { recursive: true })
  app.use('/uploads', express.static(uploadsRoot))
}

const distDir = join(__dirname, '../client/dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
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

await ensureDB()
app.listen(PORT, HOST, () => {
  console.log('StudyAppt web is running:')
  for (const url of lanUrls(PORT)) console.log(`  ${url}`)
  if (!existsSync(distDir)) {
    console.log('Frontend build not found. Run: npm --prefix ../client run build')
  }
})
