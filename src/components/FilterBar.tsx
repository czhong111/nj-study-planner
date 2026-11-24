import type { KnowledgeItem, Subject } from '../types'

interface Props {
  items: KnowledgeItem[]
  subject: Subject | '全部'
  unit: string
  examPoint: string
  onSubjectChange: (value: Subject | '全部') => void
  onUnitChange: (value: string) => void
  onExamPointChange: (value: string) => void
}

export default function FilterBar({
  items,
  subject,
  unit,
  examPoint,
  onSubjectChange,
  onUnitChange,
  onExamPointChange,
}: Props) {
  const subjects: (Subject | '全部')[] = ['全部', '语文', '数学', '英语']
  // 三级联动：单元选项随科目收窄，考点选项随科目+单元收窄
  const units = Array.from(new Set(
    items.filter((item) => subject === '全部' || item.subject === subject).map((item) => item.unit),
  ))
  const examPoints = Array.from(new Set(
    items
      .filter((item) => (subject === '全部' || item.subject === subject)
        && (unit === '全部单元' || item.unit === unit))
      .map((item) => item.examPoint),
  ))

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <span className="filter-label">科目</span>
        <div className="chip-group">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${subject === s ? 'active' : ''}`}
              onClick={() => {
                onSubjectChange(s)
                onUnitChange('全部单元')
                onExamPointChange('全部考点')
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-row">
        <label className="filter-label" htmlFor="unit-select">单元</label>
        <select
          id="unit-select"
          value={unit}
          onChange={(e) => {
            onUnitChange(e.target.value)
            onExamPointChange('全部考点')
          }}
        >
          <option value="全部单元">全部单元</option>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="filter-row">
        <label className="filter-label" htmlFor="point-select">考点</label>
        <select
          id="point-select"
          value={examPoint}
          onChange={(e) => onExamPointChange(e.target.value)}
        >
          <option value="全部考点">全部考点</option>
          {examPoints.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
    </div>
  )
}
