import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LogoMark, IconMenu, IconClose } from './icons'
import './Layout.css'

const STORAGE_KEY = 'panelSidebarCollapsed'

export function NavGroup({ label, color, active, collapsed, onExpand, children }) {
  const [open, setOpen] = useState(active)

  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const toggle = () => {
    if (collapsed) {
      onExpand?.()
      setOpen(true)
      return
    }
    setOpen(v => !v)
  }

  return (
    <div className={`nav-group${active ? ' is-active' : ''}${open && !collapsed ? ' is-open' : ''}`}>
      <button type="button" className="nav-group-label" onClick={toggle} title={label}>
        <span className="space-swatch" style={{ background: color }} />
        <span className="nav-label nav-group-text">{label}</span>
        <span className="nav-group-caret" aria-hidden>▾</span>
      </button>
      {open && !collapsed && <div className="nav-sub">{children}</div>}
    </div>
  )
}

export default function PanelShell({ brandTitle, userLabel, onBrand, onLogout, nav, children }) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [menuOpen])

  const expand = () => {
    setCollapsed(false)
    localStorage.setItem(STORAGE_KEY, '0')
  }

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const navCollapsed = collapsed && !menuOpen

  return (
    <div className={`layout layout-sidebar${collapsed ? ' is-collapsed' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
      <header className="header">
        <div className="header-inner">
          <button
            type="button"
            className="menu-trigger"
            aria-label={menuOpen ? '關閉選單' : '開啟選單'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <div className="sidebar-top">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggle}
              title={collapsed ? '展開選單' : '收合選單'}
            >
              {collapsed ? '»' : '«'}
            </button>
            <div className="sidebar-brand" onClick={onBrand} title={brandTitle}>
              <LogoMark />
              <h1 className="logo">{brandTitle}</h1>
            </div>
          </div>
          {typeof nav === 'function' ? nav({ collapsed: navCollapsed, expand }) : nav}
          <div className="user-area">
            <span className="username" title={userLabel}>{userLabel}</span>
            <button type="button" onClick={onLogout} className="btn-link sidebar-logout" title="登出">登出</button>
          </div>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
