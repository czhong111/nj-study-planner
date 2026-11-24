import { useMemo } from 'react'
import type { Grade, KnowledgeItem, Mastery, UserData } from '../types'
import ProgressBar from '../components/ProgressBar'
import MasterySelect from '../components/MasterySelect'

interface Props {
  grade: Grade
  items: KnowledgeItem[]
  data: UserData
  getMastery: (item: KnowledgeItem) => Mastery
  onMasteryChange: (id: string, mastery: Mastery) => void
}

const subjectColor: Record<string, string> = {
  语文: '#e0736d',
  数学: '#5a7bf7',
  英语: '#3fae86',
}

function percent(masteries: Mastery[]): number {
  if (masteries.length === 0) return 0
  return (masteries.filter((m) => m === '已掌握').length / masteries.length) * 100
}

export default function ProgressPage({ grade, items, data, getMastery, onMasteryChange }: Props) {
  const gradeItems = useMemo(() => items.filter((item) => item.grade === grade), [items, grade])
  const subjects = ['语文', '数学', '英语'] as const
  const allMasteries = gradeItems.map(getMastery)
  const overall = percent(allMasteries)


  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <h2>{grade} 年级 · 学习进度</h2>
          <p>进度按“已掌握考点 ÷ 总考点”计算。状态可以随时在卡片或下方直接调整。</p>
        </div>
        <div className="overall-badge">
          <strong>{Math.round(overall)}%</strong>
          <span>全年级掌握比例</span>
        </div>
      </section>

      <div className="stat-row">
        {(['已掌握', '模糊', '未掌握'] as Mastery[]).map((m) => (
          <div className="stat-card" key={m}>
            <strong>{allMasteries.filter((value) => value === m).length}</strong>
            <span>{m}考点</span>
          </div>
        ))}
      </div>

      {subjects.map((subject) => {
        const subjectItems = gradeItems.filter((item) => item.subject === subject)
        const units = Array.from(new Set(subjectItems.map((item) => item.unit)))
        const wrongCount = data.wrongEntries.filter((entry) => entry.grade === grade && entry.subject === subject).length
        return (
          <section className="panel subject-panel" key={subject}>
            <header className="subject-head">
              <h3><span className="subject-dot" style={{ backgroundColor: subjectColor[subject] }} />{subject}</h3>
              <span className="muted">错题 {wrongCount} 道 · 考点 {subjectItems.length} 个</span>
            </header>
            <ProgressBar
              value={percent(subjectItems.map(getMastery))}
              color={subjectColor[subject]}
              label="科目掌握比例"
            />
            <div className="unit-progress-list">
              {units.map((unit) => {
                const unitItems = subjectItems.filter((item) => item.unit === unit)
                return (
                  <div className="unit-progress" key={unit}>
                    <ProgressBar
                      value={percent(unitItems.map(getMastery))}
                      color={subjectColor[subject]}
                      label={unit}
                    />
                    <div className="point-chips">
                      {unitItems.map((item) => (
                        <div className={`point-chip mastery-${getMastery(item)}`} key={item.id}>
                          <span title={item.examPoint}>{item.knowledgePoint}</span>
                          <MasterySelect
                            label="状态"
                            value={getMastery(item)}
                            onChange={(value) => onMasteryChange(item.id, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
