interface Props {
  value: number
  max: number
  size?: number
}

export function ProgressRing({ value, max, size = 112 }: Props) {
  const stroke = 11
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  const offset = circumference * (1 - ratio)
  const over = value > max && max > 0

  return (
    <svg className="ring" width={size} height={size} aria-hidden="true">
      <circle
        className="ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
      />
      <circle
        className={`ring-fill${over ? ' over' : ''}`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
