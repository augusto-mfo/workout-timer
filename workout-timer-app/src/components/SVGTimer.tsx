import { CIRCLE_RADIUS, CIRCLE_CIRCUMFERENCE } from '../constants'

// ── Color Helper ──
function getTimerColor(percentage: number): string {
  let r: number, g: number, b: number, t: number
  if (percentage > 66) {
    t = (100 - percentage) / 34
    r = Math.round(34 * (1 - t) + 255 * t)
    g = Math.round(211 * (1 - t) + 255 * t)
    b = 34
  } else if (percentage > 33) {
    t = (66 - percentage) / 33
    r = 255
    g = Math.round(255 * (1 - t) + 128 * t)
    b = 34
  } else {
    t = (33 - percentage) / 33
    r = 255
    g = Math.round(128 * (1 - t))
    b = 34
  }
  return `rgb(${r},${g},${b})`
}

// ── SVG Timer Component (reusable for exercise & rest) ──
export function SVGTimer({
  totalSeconds,
  remainingSeconds,
  circleId,
  textId,
  onEnd,
  active,
}: {
  totalSeconds: number
  remainingSeconds: number
  circleId: string
  textId: string
  onEnd: () => void
  active: boolean
}) {
  const circumference = CIRCLE_CIRCUMFERENCE
  const percentage = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1
  const offset = circumference * (1 - percentage)
  const color = getTimerColor(percentage * 100)

  return (
    <div className="timer-container" role="timer" aria-label={`${remainingSeconds} seconds remaining`}>
      <svg className="timer-svg" viewBox="0 0 200 200">
        <circle className="timer-bg" cx="100" cy="100" r={CIRCLE_RADIUS} />
        <circle
          className="timer-progress"
          id={circleId}
          cx="100"
          cy="100"
          r={CIRCLE_RADIUS}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: active ? offset : 0,
            stroke: active ? color : undefined,
          }}
        />
      </svg>
      <div className="timer-text" id={textId}>
        {remainingSeconds}
      </div>
    </div>
  )
}
