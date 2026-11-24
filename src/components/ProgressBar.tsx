interface Props {
  value: number
  color?: string
  label?: string
}

export default function ProgressBar({ value, color = '#5a7bf7', label }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label">{label}<span>{clamped}%</span></div>}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
