import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './MeetHub.css'

export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const [box, setBox] = useState(null)

  useEffect(() => {
    if (!open || !btnRef.current) return
    const place = () => {
      const r = btnRef.current.getBoundingClientRect()
      const width = 156
      setBox({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  return (
    <div className="act-menu" onClick={e => e.stopPropagation()}>
      <button ref={btnRef} type="button" className="act-menu-btn" aria-label="更多操作" onClick={() => setOpen(v => !v)}>⋯</button>
      {open && box && createPortal(
        <>
          <div className="act-menu-mask" onClick={() => setOpen(false)} />
          <div className="act-menu-pop" style={{ top: box.top, left: box.left }}>
            {items.filter(Boolean).map(item => (
              <button
                key={item.label}
                type="button"
                className={item.danger ? 'is-danger' : ''}
                onClick={() => { setOpen(false); item.onClick?.() }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}