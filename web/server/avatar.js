import { mkdirSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const uploadsRoot = join(__dirname, 'uploads')
export const avatarsDir = join(uploadsRoot, 'avatars')
export const coversDir = join(uploadsRoot, 'covers')
mkdirSync(avatarsDir, { recursive: true })
mkdirSync(coversDir, { recursive: true })

const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: avatarsDir,
    filename: (req, file, cb) => {
      const userId = req.params.id || req.userId
      const ext = extname(file.originalname || '').toLowerCase()
      cb(null, `${userId}${ALLOWED.includes(ext) ? ext : '.jpg'}`)
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('請上傳圖片檔'))
    }
    cb(null, true)
  },
})

export const coverUpload = multer({
  storage: multer.diskStorage({
    destination: coversDir,
    filename: (req, file, cb) => {
      const ext = extname(file.originalname || '').toLowerCase()
      cb(null, `${req.params.id}${ALLOWED.includes(ext) ? ext : '.jpg'}`)
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      return cb(new Error('請上傳圖片檔'))
    }
    cb(null, true)
  },
})

export function avatarPublicPath(filename) {
  return `/uploads/avatars/${filename}`
}

export function coverPublicPath(filename) {
  return `/uploads/covers/${filename}`
}
