import type { Mastery } from '../types'

interface Props {
  value: Mastery
  onChange: (value: Mastery) => void
  label?: string
}

const options: Mastery[] = ['未掌握', '模糊', '已掌握']

export default function MasterySelect({ value, onChange, label = '掌握状态' }: Props) {
  return (
    <label className="mastery-field">
      <span className="mastery-label">{label}</span>
      <select
        className={`mastery-select mastery-${value}`}
        value={value}
        onChange={(e) => onChange(e.target.value as Mastery)}
        aria-label={label}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}
