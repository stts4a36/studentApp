import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './SlotPopover.css'

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

function contentLeft() {
  const main = document.querySelector('.layout-sidebar .main-content, .main-content')
  if (main) return main.getBoundingClientRect().left + 8
  return 8
}

function rectsOverlap(a, b, gap) {
  return !(a.right <= b.left - gap || a.left >= b.right + gap || a.bottom <= b.top - gap || a.top >= b.bottom + gap)
}

function placeNear(anchor, pop) {
  const ar = anchor.getBoundingClientRect()
  const pr = pop.getBoundingClientRect()
  const gap = 12
  const pad = 8
  const minL = Math.max(pad, contentLeft())
  const maxL = window.innerWidth - pr.width - pad
  const minT = pad
  const maxT = window.innerHeight - pr.height - pad
  const card = { left: ar.left, top: ar.top, right: ar.right, bottom: ar.bottom }

  const tryPlace = (left, top, placement) => {
    if (placement === 'right' && left > maxL + 1) return null
    if (placement === 'left' && left < minL - 1) return null
    if (placement === 'bottom' && top > maxT + 1) return null
    if (placement === 'top' && top < minT - 1) return null
    const l = Math.max(minL, Math.min(left, maxL))
    const t = Math.max(minT, Math.min(top, maxT))
    const popBox = { left: l, top: t, right: l + pr.width, bottom: t + pr.height }
    if (rectsOverlap(popBox, card, gap - 1)) return null
    const arrow = (placement === 'right' || placement === 'left')
      ? Math.min(pr.height - 16, Math.max(16, ar.top + ar.height / 2 - t))
      : Math.min(pr.width - 16, Math.max(16, ar.left + ar.width / 2 - l))
    return { left: l, top: t, placement, arrow }
  }

  return (
    tryPlace(ar.right + gap, ar.top, 'right')
    || tryPlace(ar.left, ar.bottom + gap, 'bottom')
    || tryPlace(ar.left - gap - pr.width, ar.top, 'left')
    || tryPlace(ar.left, ar.top - gap - pr.height, 'top')
    || {
      left: Math.max(minL, Math.min(ar.left, maxL)),
      top: Math.max(minT, Math.min(ar.bottom + gap, maxT)),
      placement: 'bottom',
      arrow: Math.min(pr.width - 16, Math.max(16, ar.width / 2)),
    }
  )
}

function centerPos(pop) {
  const pr = pop.getBoundingClientRect()
  const pad = 8
  const left = Math.max(pad, (window.innerWidth - pr.width) / 2)
  const top = Math.max(pad, Math.min((window.innerHeight - pr.height) / 2, window.innerHeight - pr.height - pad))
  return { left, top, placement: 'bottom', arrow: pr.width / 2 }
}

export default function AnchorPopover({
  anchorEl,
  title,
  onClose,
  children,
  layoutKey,
  wide,
}) {
  const [mobile, setMobile] = useState(isMobile)
  const popRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useLayoutEffect(() => {
    if (mobile || !popRef.current) {
      setPos(null)
      return
    }
    const update = () => {
      if (!popRef.current) return
      setPos(anchorEl ? placeNear(anchorEl, popRef.current) : centerPos(popRef.current))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [mobile, anchorEl, layoutKey])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const root = popRef.current
    if (!root) return
    const target = root.querySelector('.slot-pop-x, input, select, textarea')
    ;(target || root).focus()
  }, [layoutKey, mobile])

  useEffect(() => {
    if (mobile) return
    const onDown = (e) => {
      if (popRef.current?.contains(e.target)) return
      if (anchorEl?.contains?.(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [mobile, anchorEl, onClose])

  const pop = (
    <div
      ref={popRef}
      className={`slot-pop-anchor${wide ? ' is-form' : ''}${mobile ? ' is-sheet' : ''}${!mobile && pos ? ' is-ready' : ''}`}
      data-place={pos?.placement || 'right'}
      role="dialog"
      aria-labelledby="event-pop-title"
      tabIndex={-1}
      style={!mobile && pos ? { left: pos.left, top: pos.top } : (!mobile ? { visibility: 'hidden', left: 0, top: 0 } : undefined)}
      onClick={e => e.stopPropagation()}
    >
      {!mobile && pos && (
        <span
          className="slot-pop-arrow"
          style={pos.placement === 'left' || pos.placement === 'right' ? { top: pos.arrow } : { left: pos.arrow }}
        />
      )}
      <div className={`slot-pop${mobile ? ' is-sheet' : ''}`}>
        {mobile && <div className="sched-sheet-handle" />}
        <div className="slot-pop-head">
          <div className="slot-pop-title">
            <strong id="event-pop-title">{title}</strong>
          </div>
          <button type="button" className="slot-pop-x" onClick={onClose} aria-label="關閉">✕</button>
        </div>
        {children}
      </div>
    </div>
  )

  if (mobile) {
    return (
      <div className="slot-pop-mask" onClick={onClose}>
        {pop}
      </div>
    )
  }
  return pop
}
