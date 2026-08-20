import { Router as ExpressRouter } from 'express'

function wrap(fn) {
  if (typeof fn !== 'function' || fn.length > 3) return fn
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

export function Router() {
  const router = ExpressRouter()
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all', 'use']) {
    const orig = router[method].bind(router)
    router[method] = (...args) => orig(...args.map((arg) => (typeof arg === 'function' ? wrap(arg) : arg)))
  }
  return router
}
