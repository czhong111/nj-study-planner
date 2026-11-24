import type { Grade } from '../types'

interface Props {
  grade: Grade
  onChange: (grade: Grade) => void
}

const grades: Grade[] = [3, 4, 5, 6]

export default function GradeSwitcher({ grade, onChange }: Props) {
  return (
    <div className="grade-switcher" role="group" aria-label="切换年级">
      {grades.map((g) => (
        <button
          key={g}
          type="button"
          className={`grade-btn ${grade === g ? 'active' : ''}`}
          aria-pressed={grade === g}
          onClick={() => onChange(g)}
        >
          {g}年级
        </button>
      ))}
    </div>
  )
}
