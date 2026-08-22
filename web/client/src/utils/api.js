import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE
    ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, '')}/api`
    : '/api',
  timeout: 60000,
})

function requestUrl(config) {
  return `${config.baseURL || ''}${config.url || ''}`
}

function isLoginRequest(config) {
  return /\/(user|admin|work)\/login\b/.test(requestUrl(config))
}

function go(path) {
  if (window.location.pathname !== path) {
    window.location.href = path
  }
}

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const url = config.url || ''
    let token = null
    if (url.startsWith('/admin')) token = localStorage.getItem('adminToken')
    else if (url.startsWith('/work')) token = localStorage.getItem('workToken')
    else token = localStorage.getItem('token') || localStorage.getItem('workToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401 && err.config && !isLoginRequest(err.config)) {
      const url = err.config.url || ''
      const auth = String(err.config.headers?.Authorization || '')
      const adminToken = localStorage.getItem('adminToken')
      const workToken = localStorage.getItem('workToken')

      if (url.startsWith('/admin') || (adminToken && auth.includes(adminToken))) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('admin')
        go('/admin/login')
      } else if (url.startsWith('/work') || (workToken && auth.includes(workToken))) {
        localStorage.removeItem('workToken')
        localStorage.removeItem('work')
        localStorage.removeItem('workMeetId')
        go('/work/login')
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        go('/login')
      }
    }
    return Promise.reject(err.response?.data || err)
  }
)

export function apiError(err, fallback = '操作失敗') {
  return err?.msg || err?.message || fallback
}

export default api
