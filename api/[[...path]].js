'use strict'

const { pathToFileURL } = require('url')
const { join } = require('path')

// Vercel bundles static import()/import into require(), which cannot load ESM.
const importEsm = new Function('u', 'return import(u)')

let appPromise
function loadApp() {
  if (!appPromise) {
    const file = join(__dirname, '..', 'web', 'server', 'app.js')
    appPromise = importEsm(pathToFileURL(file).href).then((mod) => mod.default)
  }
  return appPromise
}

module.exports = async function handler(req, res) {
  const app = await loadApp()
  return app(req, res)
}

module.exports.config = {
  maxDuration: 30,
}
