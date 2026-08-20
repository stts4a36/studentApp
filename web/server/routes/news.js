import { Router } from '../router.js'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function parseJSON(str, fallback = []) {
  try { return JSON.parse(str) } catch { return fallback }
}

// Public news list
router.get('/list', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const rows = await db.prepare('SELECT * FROM news WHERE NEWS_STATUS = 1 ORDER BY NEWS_ORDER ASC, NEWS_ADD_TIME DESC LIMIT ?').all(limit)
  rows.forEach(r => { r.NEWS_CONTENT = parseJSON(r.NEWS_CONTENT) })
  res.json({ data: rows })
})

// News detail
router.get('/:id', async (req, res) => {
  const news = await db.prepare('SELECT * FROM news WHERE NEWS_ID = ?').get(req.params.id)
  if (!news) return res.status(404).json({ msg: '未找到' })
  
  // Increment view count
  await db.prepare('UPDATE news SET NEWS_VIEW_CNT = NEWS_VIEW_CNT + 1 WHERE NEWS_ID = ?').run(req.params.id)
  news.NEWS_VIEW_CNT += 1
  news.NEWS_CONTENT = parseJSON(news.NEWS_CONTENT)
  res.json({ data: news })
})

export default router
