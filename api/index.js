'use strict'

const { pathToFileURL } = require('url')
const { join } = require('path')

const importEsm = new Function('u', 'return import(u)')

let appPromise
function loadApp() {
  if (!appPromise) {
    const file = join(__dirname, '..', 'web', 'server', 'app.js')
    appPromise = importEsm(pathToFileURL(file).href).then((mod) => mod.default)
  }
  return appPromise
}

function restoreUrl(req) {
  const incoming = req.url || '/'
  const u = new URL(incoming, 'http://localhost')
  let extra = u.searchParams.get('path')
  if (!extra && req.query && req.query.path != null) {
    extra = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path)
  }
  if (!extra) return
  u.searchParams.delete('path')
  const qs = u.searchParams.toString()
  const suffix = extra.replace(/^\/+/, '').replace(/^api\//, '')
  req.url = `/api/${suffix}${qs ? `?${qs}` : ''}`
}

module.exports = async function handler(req, res) {
  try {
    restoreUrl(req)
    const app = await loadApp()
    return app(req, res)
  } catch (err) {
    console.error(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ msg: err.message || 'API failed to start' }))
  }
}

module.exports.config = {
  maxDuration: 30,
}
