import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverless = Boolean(process.env.VERCEL)

export const uploadsRoot = serverless
  ? join(tmpdir(), 'study-appt-uploads')
  : join(__dirname, 'uploads')
export const avatarsDir = join(uploadsRoot, 'avatars')
export const coversDir = join(uploadsRoot, 'covers')

export function ensureUploads() {
  mkdirSync(avatarsDir, { recursive: true })
  mkdirSync(coversDir, { recursive: true })
}

if (!serverless) ensureUploads()

const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function imageFilter(_req, file, cb) {
  if (!String(file.mimetype || '').startsWith('image/')) {
    return cb(new Error('請上傳圖片檔'))
  }
  cb(null, true)
}

function diskStorage(dir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const userId = req.params.id || req.userId
      const ext = extname(file.originalname || '').toLowerCase()
      cb(null, `${userId}${ALLOWED.includes(ext) ? ext : '.jpg'}`)
    },
  })
}

function coverDiskStorage(dir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = extname(file.originalname || '').toLowerCase()
      cb(null, `${req.params.id}${ALLOWED.includes(ext) ? ext : '.jpg'}`)
    },
  })
}

const memory = multer.memoryStorage()

export const avatarUpload = multer({
  storage: serverless ? memory : diskStorage(avatarsDir),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const coverUpload = multer({
  storage: serverless ? memory : coverDiskStorage(coversDir),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export function filePublicUrl(file, kind = 'avatars') {
  if (!file) return ''
  if (file.buffer) {
    const mime = String(file.mimetype || 'image/jpeg').split(';')[0] || 'image/jpeg'
    return `data:${mime};base64,${file.buffer.toString('base64')}`
  }
  return kind === 'covers'
    ? `/uploads/covers/${file.filename}`
    : `/uploads/avatars/${file.filename}`
}

export function avatarPublicPath(filename) {
  return `/uploads/avatars/${filename}`
}

export function coverPublicPath(filename) {
  return `/uploads/covers/${filename}`
}
