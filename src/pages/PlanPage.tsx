import { useMemo, useState } from 'react'
import type { Difficulty, Grade, KnowledgeItem, Mastery, Subject } from '../types'
import FilterBar from '../components/FilterBar'
import KnowledgeCard from '../components/KnowledgeCard'

interface Props {
  grade: Grade
  items: KnowledgeItem[]
  getMastery: (item: KnowledgeItem) => Mastery
  onMasteryChange: (id: string, mastery: Mastery) => void
}

const difficulties: (Difficulty | '全部')[] = ['全部', '基础', '提升', '挑战']

export default function PlanPage({ grade, items, getMastery, onMasteryChange }: Props) {
  const [subject, setSubject] = useState<Subject | '全部'>('全部')
  const [unit, setUnit] = useState('全部单元')
  const [examPoint, setExamPoint] = useState('全部考点')
  const [difficulty, setDifficulty] = useState<Difficulty | '全部'>('全部')

  const gradeItems = useMemo(() => items.filter((item) => item.grade === grade), [items, grade])

  const filtered = useMemo(() => gradeItems.filter((item) =>
    (subject === '全部' || item.subject === subject) &&
    (unit === '全部单元' || item.unit === unit) &&
    (examPoint === '全部考点' || item.examPoint === examPoint) &&
    (difficulty === '全部' || item.difficulty === difficulty),
  ), [gradeItems, subject, unit, examPoint, difficulty])

  const counts = difficulties.map((d) => ({
    key: d,
    count: d === '全部' ? filtered.length : filtered.filter((item) => item.difficulty === d).length,
  }))

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <h2>{grade} 年级 · 预习与复习计划</h2>
          <p>先选科目和单元，再按考点查看预习要点、复习资料和示例练习。每天完成一小格就很棒！</p>
        </div>
        <div className="daily-tip">
          <strong>校内学习节奏小贴士</strong>
          <span>语文：熟读标自然段 → 生字组词 → 圈疑词 → 看课后题</span>
          <span>数学：重视基础题，错题按 1 周 / 2 周 / 1 个月再练</span>
          <span>英语：字母 → 单词 → 短语 → 句型，每天 10—15 分钟</span>
        </div>
      </section>

      <FilterBar
        items={gradeItems}
        subject={subject}
        unit={unit}
        examPoint={examPoint}
        onSubjectChange={setSubject}
        onUnitChange={setUnit}
        onExamPointChange={setExamPoint}
      />

      <div className="difficulty-bar" role="group" aria-label="难度筛选">
        <span className="filter-label">难度</span>
        {counts.map(({ key, count }) => (
          <button
            key={key}
            type="button"
            className={`chip ${difficulty === key ? 'active' : ''}`}
            onClick={() => setDifficulty(key)}
          >
            {key} <em>{count}</em>
          </button>
        ))}
      </div>

      <p className="result-line">
        当前显示 <strong>{filtered.length}</strong> 个考点
        {examPoint !== '全部考点' ? ` · ${examPoint}` : ''}
      </p>

      {difficulties.filter((d) => d !== '全部').map((level) => {
        const group = filtered.filter((item) => item.difficulty === level)
        if (group.length === 0) return null
        return (
          <section className="difficulty-section" key={level}>
            <h3 className={`section-title ${level === '基础' ? 'level-easy' : level === '提升' ? 'level-medium' : 'level-hard'}`}>
              {level}档 <span>{group.length} 个考点</span>
            </h3>
            <div className="card-grid">
              {group.map((item) => (
                <KnowledgeCard
                  key={item.id}
                  item={item}
                  mastery={getMastery(item)}
                  onMasteryChange={onMasteryChange}
                />
              ))}
            </div>
          </section>
        )
      })}

      {filtered.length === 0 && (
        <div className="empty-state">这个组合下暂无考点，换个科目或单元试试看。</div>
      )}
    </div>
  )
}
