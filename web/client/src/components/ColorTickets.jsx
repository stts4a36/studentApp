import { COURSE_PALETTE, courseToken } from '../utils/color'
import './MeetHub.css'

export default function ColorTickets({ value = 0, onChange, disabled = false }) {
  const selected = Number.isFinite(Number(value)) && Number(value) >= 0
    ? Math.trunc(Number(value)) % COURSE_PALETTE.length
    : 0
  return (
    <div className="color-tickets" role="listbox" aria-label="色票">
      {COURSE_PALETTE.map((_, i) => (
        <button
          key={i}
          type="button"
          role="option"
          aria-selected={selected === i}
          className={selected === i ? 'on' : ''}
          style={{ background: courseToken(i).solid }}
          disabled={disabled}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  )
}
