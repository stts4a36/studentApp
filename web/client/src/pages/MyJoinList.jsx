import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../utils/api'
import { displayTitle, formatClock12, WEEK_LABELS } from '../utils/days'
import { courseToken } from '../utils/color'
import '../components/ScheduleBoard.css'

function phase(item, now) {
  if (item.JOIN_STATUS === 2) return { text: '候補中', ended: false }
  if (item.JOIN_STATUS !== 1) return { text: '已取消', ended: true }
  const start = dayjs(`${item.JOIN_MEET_DAY} ${item.JOIN_MEET_TIME_START || '00:00'}`)
  const end = dayjs(`${item.JOIN_MEET_DAY} ${item.JOIN_MEET_TIME_END || item.JOIN_MEET_TIME_START || '23:59'}`)
  if (now.isBefore(start)) return { text: '即將開始', ended: false }
  if (now.isBefore(end)) return { text: '進行中', ended: false }
  return { text: '已完成', ended: true }
}

function groupByDay(rows) {
  const map = {}
  const order = []
  for (const row of rows) {
    const day = row.item.JOIN_MEET_DAY
    if (!map[day]) {
      map[day] = []
      order.push(day)
    }
    map[day].push(row)
  }
  return order.map(day => ({ day, items: map[day] }))
}

function dayHead(day, count, now) {
  const d = dayjs(day)
  return `${d.format('M月D日')} ${WEEK_LABELS[d.day()]}${d.isSame(now, 'day') ? ' · 今天' : ''} · ${count} 堂`
}

function JoinCard({ item, info, now, onOpen }) {
  const token = courseToken(item.MEET_COLOR_INDEX, item.JOIN_MEET_ID)
  const today = dayjs(item.JOIN_MEET_DAY).isSame(now, 'day')
  const past = info.ended && !today
  return (
    <button
      type="button"
      className={`sched-ev${past ? ' is-past' : ''}${today && info.ended ? ' is-today' : ''}`}
      style={{ '--assigned-color': past ? '#b0b4ba' : token.solid, '--assigned-text': token.text }}
      onClick={onOpen}
    >
      <span className="sched-ev-when">
        <b>{formatClock12(item.JOIN_MEET_TIME_START)}</b>
        <em>{formatClock12(item.JOIN_MEET_TIME_END)}</em>
      </span>
      <div className="sched-ev-main">
        <div className="sched-ev-top">
          <span>{displayTitle(item.JOIN_MEET_TITLE)}</span>
          {item.JOIN_MEET_CATE_NAME ? <em className="sched-ev-kind">{item.JOIN_MEET_CATE_NAME}</em> : null}
          {today && info.ended && <em className="sched-ev-today">今天</em>}
        </div>
        <div className="sched-ev-bot">
          <span className="sched-ev-teacher">{info.text}</span>
          {item.JOIN_CREDIT != null && Number(item.JOIN_CREDIT) > 0 && (
            <span className="sched-ev-cap">{item.JOIN_CREDIT} Credit</span>
          )}
          <span className="sched-ev-go">›</span>
        </div>
      </div>
    </button>
  )
}

function MyJoinList() {
  const [list, setList] = useState([])
  const [endedOpen, setEndedOpen] = useState(false)
  const navigate = useNavigate()
  const now = dayjs()

  useEffect(() => {
    api.get('/meet/my-joins').then(res => setList(res.data || [])).catch(() => setList([]))
  }, [])

  const rows = useMemo(() => {
    return [...list]
      .map(item => ({ item, info: phase(item, now) }))
      .sort((a, b) => `${a.item.JOIN_MEET_DAY} ${a.item.JOIN_MEET_TIME_START}`.localeCompare(`${b.item.JOIN_MEET_DAY} ${b.item.JOIN_MEET_TIME_START}`))
  }, [list, now])

  const liveGroups = useMemo(() => groupByDay(rows.filter(r => !r.info.ended)), [rows])
  const endedGroups = useMemo(
    () => groupByDay(rows.filter(r => r.info.ended)).reverse(),
    [rows],
  )
  const endedCount = endedGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="page-container">
      <div className="content-title-row">
        <span className="content-title-icon" />
        <h1 className="content-title">我的報名</h1>
      </div>
      <div className="join-agenda">
        {liveGroups.length === 0 && endedCount === 0 && <p className="sched-empty">目前沒有報名</p>}
        {liveGroups.length === 0 && endedCount > 0 && <p className="sched-empty">目前沒有即將開始的報名</p>}
        {liveGroups.map(group => (
          <section key={group.day} className="sched-agenda-group">
            <h3 className="sched-agenda-sticky">{dayHead(group.day, group.items.length, now)}</h3>
            {group.items.map(({ item, info }) => (
              <JoinCard
                key={item.JOIN_ID}
                item={item}
                info={info}
                now={now}
                onOpen={() => navigate(`/my/joins/${item.JOIN_ID}`)}
              />
            ))}
          </section>
        ))}
        {endedCount > 0 && (
          <div className="sched-ended">
            <button type="button" className="sched-ended-toggle" onClick={() => setEndedOpen(v => !v)}>
              已結束（{endedCount}）
              <span>{endedOpen ? '▴' : '▾'}</span>
            </button>
            {endedOpen && endedGroups.map(group => (
              <section key={group.day} className="sched-agenda-group sched-ended-list">
                <h3 className="sched-agenda-sticky">{dayHead(group.day, group.items.length, now)}</h3>
                {group.items.map(({ item, info }) => (
                  <JoinCard
                    key={item.JOIN_ID}
                    item={item}
                    info={info}
                    now={now}
                    onOpen={() => navigate(`/my/joins/${item.JOIN_ID}`)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyJoinList
