import { useState } from 'react'
import type { DataUpdater, UserData } from '../types'
import { calcStreak, recentDays, shortDate, todayKey } from '../utils/date'

interface Props {
  data: UserData
  update: DataUpdater
}

export default function CheckinPage({ data, update }: Props) {
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const today = todayKey()
  const todayRecord = data.checkins.find((record) => record.date === today)
  const streak = calcStreak(data.checkins.map((record) => record.date))
  const days = recentDays(21)
  const checked = new Set(data.checkins.map((record) => record.date))
  const totalReviews = data.checkins.reduce((sum, record) => sum + record.wrongReviewed, 0)

  function checkIn() {
    const safeCount = Math.max(0, Math.min(99, count || 0))
    update((prev) => {
      const exists = prev.checkins.some((record) => record.date === today)
      return {
        ...prev,
        checkins: exists
          ? prev.checkins.map((record) => record.date === today
            ? { ...record, wrongReviewed: safeCount, note: note.trim() || record.note }
            : record)
          : [...prev.checkins, { date: today, wrongReviewed: safeCount, note: note.trim() }],
      }
    })
    setSaved(true)
  }

  return (
    <div className="page">
      <section className="hero-card checkin-hero">
        <div>
          <h2>每日错题打卡</h2>
          <p>每天花几分钟回看错题，连续打卡会让复习变成习惯。今天也开始吧！</p>
        </div>
        <div className="streak-box">
          <strong>{streak}</strong>
          <span>连续打卡天数</span>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat-card"><strong>{data.checkins.length}</strong><span>累计打卡天数</span></div>
        <div className="stat-card"><strong>{totalReviews}</strong><span>累计巩固题次</span></div>
        <div className="stat-card"><strong>{todayRecord ? todayRecord.wrongReviewed : 0}</strong><span>今日巩固题数</span></div>
      </div>

      <section className="panel">
        <h3>今日打卡</h3>
        <div className="checkin-form">
          <label className="field compact">
            <span>今天巩固了几道错题</span>
            <input type="number" min={0} max={99} value={count} onChange={(e) => { setCount(Number(e.target.value)); setSaved(false) }} />
          </label>
          <label className="field compact">
            <span>今日小记（可选）</span>
            <input value={note} onChange={(e) => { setNote(e.target.value); setSaved(false) }} placeholder="例如：乘数中间有 0 的题都做对了" />
          </label>
          <button type="button" className="btn primary" onClick={checkIn}>
            {todayRecord ? '更新今日打卡' : '完成今日打卡'}
          </button>
        </div>
        {saved && <p className="success-note">打卡成功！每天进步一点点，真的很了不起。</p>}
      </section>

      <section className="panel">
        <h3>最近 21 天</h3>
        <div className="calendar-grid">
          {days.map((day) => (
            <div key={day} className={`day-cell ${checked.has(day) ? 'checked' : ''} ${day === today ? 'today' : ''}`} title={day}>
              <span>{Number(day.slice(8))}</span>
              <i />
            </div>
          ))}
        </div>
        <p className="muted">有实心圆点的日期表示当天已完成打卡。</p>
      </section>

      <section className="panel">
        <h3>打卡记录</h3>
        {data.checkins.length === 0 ? (
          <div className="empty-state">还没有打卡记录，完成上面第一次打卡吧。</div>
        ) : (
          <ul className="record-list">
            {[...data.checkins].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((record) => (
              <li key={record.date}>
                <strong>{shortDate(record.date)}</strong>
                <span>巩固 {record.wrongReviewed} 题</span>
                {record.note && <em>{record.note}</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
