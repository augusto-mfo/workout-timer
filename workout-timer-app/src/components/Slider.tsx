import { CIRCLE_RADIUS, CIRCLE_CIRCUMFERENCE } from '../constants'
import { formatSeconds } from '../helpers'

// ── Slider (label + live value + range input) ──
export function Slider({
  id, label, value, min, max, step = 1, format, onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="field">
      <div className="slider-head">
        <label htmlFor={id} className="section-label">{label}</label>
        <output htmlFor={id} className="slider-value">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}
