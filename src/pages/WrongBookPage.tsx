import { useMemo, useState } from 'react'
import type { DataUpdater, Grade, Mastery, Subject, UserData, UserWrongEntry } from '../types'
import WrongEntryForm from '../components/WrongEntryForm'
import WrongEntryCard from '../components/WrongEntryCard'
import KbSyncPanel from '../components/KbSyncPanel'
import { todayKey } from '../utils/date'

interface Props {
  grade: Grade
  data: UserData
  update: DataUpdater
  allItems: import('../types').KnowledgeItem[]
}

const masteryFilters: (Mastery | '全部')[] = ['全部', '未掌握', '模糊', '已掌握']

export default function WrongBookPage({ grade, data, update, allItems }: Props) {
  const [adding, setAdding] = useState(false)
  const [subject, setSubject] = useState<Subject | '全部'>('全部')
  const [masteryFilter, setMasteryFilter] = useState<Mastery | '全部'>('全部')
  const [query, setQuery] = useState('')

  const gradeEntries = useMemo(
    () => data.wrongEntries.filter((entry) => entry.grade === grade),
    [data.wrongEntries, grade],
  )

  const visible = useMemo(() => gradeEntries.filter((entry) => {
    const q = query.trim().toLowerCase()
    return (subject === '全部' || entry.subject === subject)
      && (masteryFilter === '全部' || entry.mastery === masteryFilter)
      && (!q || `${entry.question} ${entry.reason} ${entry.myAnswer} ${entry.correctAnswer} ${entry.matchedExamPoint ?? ''}`.toLowerCase().includes(q))
  }), [gradeEntries, subject, masteryFilter, query])

  function addEntry(entry: Omit<UserWrongEntry, 'id' | 'createdAt' | 'reviewCount'>) {
    const newEntry: UserWrongEntry = {
      ...entry,
      id: `wrong-${Date.now()}`,
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      mastery: '未掌握',
    }
    update((prev) => ({ ...prev, wrongEntries: [newEntry, ...prev.wrongEntries] }))
    setAdding(false)
    setQuery('')
  }

  function changeMastery(id: string, mastery: Mastery) {
    update((prev) => {
      const target = prev.wrongEntries.find((entry) => entry.id === id)
      return {
        ...prev,
        wrongEntries: prev.wrongEntries.map((entry) => entry.id === id ? { ...entry, mastery } : entry),
        masteryOverrides: target?.matchedKnowledgeId
          ? { ...prev.masteryOverrides, [target.matchedKnowledgeId]: mastery }
          : prev.masteryOverrides,
      }
    })
  }

  function review(entry: UserWrongEntry) {
    const date = todayKey()
    update((prev) => {
      const existing = prev.checkins.find((record) => record.date === date)
      const checkins = existing
        ? prev.checkins.map((record) => record.date === date
          ? { ...record, wrongReviewed: record.wrongReviewed + 1 }
          : record)
        : [...prev.checkins, { date, wrongReviewed: 1 }]
      return {
        ...prev,
        wrongEntries: prev.wrongEntries.map((item) => item.id === entry.id
          ? { ...item, reviewCount: item.reviewCount + 1 }
          : item),
        checkins,
      }
    })
  }

  function remove(id: string) {
    update((prev) => ({ ...prev, wrongEntries: prev.wrongEntries.filter((entry) => entry.id !== id) }))
  }

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <h2>{grade} 年级 · 错题本</h2>
          <p>直接拍照，GLM 自动识别题目并匹配考点，确认后即可存入错题本并归档到 GradeⅢ。</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setAdding((v) => !v)}>
          {adding ? '收起拍照录入' : '📷 拍照录入错题'}
        </button>
      </section>

      {adding && (
        <section className="panel">
          <WrongEntryForm
            grade={grade}
            items={allItems}
            onSubmit={addEntry}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      <KbSyncPanel grade={grade} />

      <section className="panel">
        <div className="toolbar">
          <div className="chip-group">
            {(['全部', '语文', '数学', '英语'] as const).map((s) => (
              <button key={s} type="button" className={`chip ${subject === s ? 'active' : ''}`} onClick={() => setSubject(s)}>{s}</button>
            ))}
          </div>
          <div className="chip-group">
            {masteryFilters.map((m) => (
              <button key={m} type="button" className={`chip ${masteryFilter === m ? 'active' : ''}`} onClick={() => setMasteryFilter(m)}>{m}</button>
            ))}
          </div>
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索题干、错因、答案或考点"
            aria-label="搜索错题"
          />
        </div>
        <p className="result-line">共 {visible.length} 道错题（当前年级）</p>

        <div className="wrong-list">
          {visible.map((entry) => (
            <WrongEntryCard
              key={entry.id}
              entry={entry}
              item={allItems.find((item) => item.id === entry.matchedKnowledgeId)}
              onMasteryChange={changeMastery}
              onReview={review}
              onDelete={remove}
            />
          ))}
          {visible.length === 0 && (
            <div className="empty-state">还没有符合条件的错题，点“拍照录入错题”拍下第一道吧。</div>
          )}
        </div>
      </section>
    </div>
  )
}
