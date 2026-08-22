import { useEffect, useState } from 'react'
import { loadHours, saveHours, subscribeHours, padHour } from '../utils/hours'
import './Settings.css'

export default function Settings() {
  const [hours, setHours] = useState(loadHours)

  useEffect(() => subscribeHours(setHours), [])

  const changeHours = (next) => {
    setHours(saveHours(next))
  }

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">設定</h1>
      </div>
      <div className="settings-list">
        <section className="card settings-item">
          <div className="settings-item-copy">
            <h2>營業時間</h2>
            <p>團隊檢視與日曆檢視共用此時段範圍</p>
          </div>
          <label className="settings-hours">
            <select value={hours.start} onChange={e => changeHours({ ...hours, start: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 6).map(h => (
                <option key={h} value={h}>{padHour(h)}</option>
              ))}
            </select>
            <span>–</span>
            <select value={hours.end} onChange={e => changeHours({ ...hours, end: Number(e.target.value) })}>
              {Array.from({ length: 11 }, (_, i) => i + 14).map(h => (
                <option key={h} value={h} disabled={h <= hours.start}>{padHour(h)}</option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </div>
  )
}
