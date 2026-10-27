import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ──
type WorkoutMode = 'reps' | 'timed'
type ScreenId = 'setup' | 'rep' | 'exercise' | 'rest' | 'final'

interface WorkoutState {
  mode: WorkoutMode
  total: number
  current: number
  restSeconds: number
  holdSeconds: number
}

// ── SVG Timer Constants ──
const CIRCLE_RADIUS = 80
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

// ── Color Helper (identical to original) ──
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

// ── Validation ──
function validate(value: number, name: string): boolean {
  if (!value || value < 1) {
    alert(`Please enter a valid ${name}.`)
    return false
  }
  return true
}

// ── SVG Timer Component (reusable for exercise & rest) ──
function SVGTimer({
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
    <div className="timer-container">
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

// ── Main App Component ──
export default function App() {
  // ── State ──
  const [mode, setMode] = useState<WorkoutMode>('reps')
  const [screen, setScreen] = useState<ScreenId>('setup')
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [holdSeconds, setHoldSeconds] = useState(0)

  // Input values (uncontrolled for simplicity)
  const repsRef = useRef<HTMLInputElement>(null)
  const restRef = useRef<HTMLInputElement>(null)
  const setsRef = useRef<HTMLInputElement>(null)
  const holdRef = useRef<HTMLInputElement>(null)
  const timedRestRef = useRef<HTMLInputElement>(null)

  const getNum = (el: HTMLInputElement | null, fallback = 0) =>
    parseInt(el?.value ?? String(fallback), 10)

  // Timer state
  const [exerciseRemaining, setExerciseRemaining] = useState(0)
  const [restRemaining, setRestRemaining] = useState(0)
  const [exerciseRunning, setExerciseRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Refs for current/total to avoid stale closures in interval callbacks
  const currentRef = useRef(current)
  const totalRef = useRef(total)
  const modeRef = useRef(mode)
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { totalRef.current = total }, [total])
  useEffect(() => { modeRef.current = mode }, [mode])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current!)
    }
  }, [])

  // ── Screen Navigation ──
  const showScreen = useCallback((id: ScreenId) => {
    setScreen(id)
  }, [])

  // ── Mode Selection ──
  const selectMode = useCallback((m: WorkoutMode) => {
    setMode(m)
  }, [])

  // ── Start Workout ──
  const startWorkout = useCallback(() => {
    if (mode === 'reps') {
      const repsVal = getNum(repsRef.current, 10)
      const restVal = getNum(restRef.current, 30)
      if (!validate(repsVal, 'reps') || !validate(restVal, 'rest')) return
      setTotal(repsVal)
      setRestSeconds(restVal)
      setCurrent(1)
      showScreen('rep')
    } else {
      const setsVal = getNum(setsRef.current, 5)
      const holdVal = getNum(holdRef.current, 30)
      const timedRestVal = getNum(timedRestRef.current, 30)
      if (
        !validate(setsVal, 'sets') ||
        !validate(holdVal, 'hold time') ||
        !validate(timedRestVal, 'rest')
      )
        return
      setTotal(setsVal)
      setHoldSeconds(holdVal)
      setRestSeconds(timedRestVal)
      setCurrent(1)
      setExerciseRemaining(holdVal)
      showScreen('exercise')
    }
  }, [mode, showScreen])

  // ── Countdown Logic ──
  const startCountdown = useCallback(
    (
      totalSec: number,
      setRemaining: React.Dispatch<React.SetStateAction<number>>,
      onEnd: () => void
    ) => {
      let remaining = totalSec
      setRemaining(remaining)

      if (intervalRef.current) clearInterval(intervalRef.current!)

      intervalRef.current = setInterval(() => {
        remaining--
        if (remaining <= 0) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          onEnd()
        } else {
          setRemaining(remaining)
        }
      }, 1000)
    },
    []
  )

  // ── Screen Navigation Helpers ──
  const showRepScreen = useCallback(() => {
    setScreen('rep')
  }, [])

  const showExerciseScreen = useCallback(() => {
    setExerciseRemaining(holdSeconds)
    setExerciseRunning(false)
    showScreen('exercise')
  }, [holdSeconds, showScreen])

  // ── Rest Timer ──
  const startRestTimer = useCallback(() => {
    setRestRemaining(restSeconds)
    showScreen('rest')
    startCountdown(restSeconds, setRestRemaining, finishRest)
  }, [restSeconds, showScreen, startCountdown])

  const skipRest = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current!)
      intervalRef.current = null
    }
    finishRest()
  }, [])

  const finishRest = useCallback(() => {
    if (modeRef.current === 'reps') {
      // current already incremented in doneRep
      if (currentRef.current > totalRef.current) {
        showFinalScreen()
      } else {
        showRepScreen()
      }
    } else {
      // timed mode: increment here (doneRep not used)
      if (currentRef.current >= totalRef.current) {
        showFinalScreen()
      } else {
        setCurrent(prev => prev + 1)
        setExerciseRunning(false)
        showExerciseScreen()
      }
    }
  }, [showRepScreen, showExerciseScreen])

  // ── Rep Screen ──
  const doneRep = useCallback(() => {
    setCurrent(prev => prev + 1)
    startRestTimer()
  }, [startRestTimer])

  // ── Start Exercise ──
  const startExercise = useCallback(() => {
    setExerciseRunning(true)
    startCountdown(
      holdSeconds,
      setExerciseRemaining,
      startRestTimer
    )
  }, [holdSeconds, startCountdown])

  // ── Final Screen ──
  const showFinalScreen = useCallback(() => {
    showScreen('final')
  }, [showScreen])

  // ── Restart ──
  const restart = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current!)
      intervalRef.current = null
    }
    setExerciseRunning(false)
    setCurrent(0)
    setTotal(0)
    setScreen('setup')
  }, [])

  // ── Render Helpers ──
  const isExerciseActive = screen === 'exercise' && exerciseRunning

  // ── Render ──
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Glow Orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <div className="glow-orb glow-orb-3" />

      <div className="glass p-8 max-w-md w-full">
        {/* ── Setup Screen ── */}
        {screen === 'setup' && (
          <div className="screen active">
            <div className="title">Workout Timer</div>
            <div className="mode-selector flex gap-3 mb-6">
              <button
                className={`mode-btn ${mode === 'reps' ? 'active' : ''}`}
                onClick={() => selectMode('reps')}
              >
                Reps
              </button>
              <button
                className={`mode-btn ${mode === 'timed' ? 'active' : ''}`}
                onClick={() => selectMode('timed')}
              >
                Timed Exercise
              </button>
            </div>

            {/* Reps Mode */}
            <div className={mode === 'reps' ? 'mode-section active' : 'mode-section'}>
              <label htmlFor="reps-input" className="section-label">
                Number of Reps
              </label>
              <input
                ref={repsRef}
                type="number"
                id="reps-input"
                min="1"
                defaultValue={10}
                className="glass-input"
              />
              <label htmlFor="rest-input" className="section-label">
                Rest Between Reps (seconds)
              </label>
              <input
                ref={restRef}
                type="number"
                id="rest-input"
                min="1"
                defaultValue={30}
                className="glass-input"
              />
            </div>

            {/* Timed Exercise Mode */}
            <div className={mode === 'timed' ? 'mode-section active' : 'mode-section'}>
              <label htmlFor="sets-input" className="section-label">
                Number of Sets
              </label>
              <input
                ref={setsRef}
                type="number"
                id="sets-input"
                min="1"
                defaultValue={5}
                className="glass-input"
              />
              <label htmlFor="hold-input" className="section-label">
                Hold Time (seconds)
              </label>
              <input
                ref={holdRef}
                type="number"
                id="hold-input"
                min="1"
                defaultValue={30}
                className="glass-input"
              />
              <label htmlFor="timed-rest-input" className="section-label">
                Rest Between Sets (seconds)
              </label>
              <input
                ref={timedRestRef}
                type="number"
                id="timed-rest-input"
                min="1"
                defaultValue={30}
                className="glass-input"
              />
            </div>

            <div className="mt-6">
              <button className="glass-btn glass-btn-primary" onClick={startWorkout}>
                Start
              </button>
            </div>
          </div>
        )}

        {/* ── Rep Screen ── */}
        {screen === 'rep' && (
          <div className="screen active">
            <div className="rep-info">
              Rep {current} of {total}
            </div>
            <div className="btn-group">
              <button className="glass-btn glass-btn-done" onClick={doneRep}>
                Done
              </button>
              <button className="glass-btn" onClick={restart}>
                Back to Start
              </button>
            </div>
          </div>
        )}

        {/* ── Exercise Screen ── */}
        {screen === 'exercise' && (
          <div className="screen active">
            <div className="exercise-label">Hold</div>
            <div className="exercise-info">
              Set {current} of {total}
            </div>
            <SVGTimer
              totalSeconds={holdSeconds}
              remainingSeconds={exerciseRemaining}
              circleId="exercise-timer-circle"
              textId="exercise-timer-text"
              onEnd={startRestTimer}
              active={isExerciseActive}
            />
            <div className="btn-group">
              {!exerciseRunning && (
                <button
                  className="glass-btn glass-btn-exercise"
                  onClick={startExercise}
                >
                  Start
                </button>
              )}
              <button className="glass-btn" onClick={restart}>
                Back to Start
              </button>
            </div>
          </div>
        )}

        {/* ── Rest Screen ── */}
        {screen === 'rest' && (
          <div className="screen active">
            <div className="title">Rest</div>
            <SVGTimer
              totalSeconds={restSeconds}
              remainingSeconds={restRemaining}
              circleId="rest-timer-circle"
              textId="rest-timer-text"
              onEnd={finishRest}
              active
            />
            <div className="btn-group">
              <button className="glass-btn glass-btn-primary" onClick={skipRest}>
                Skip Rest
              </button>
            </div>
          </div>
        )}

        {/* ── Final Screen ── */}
        {screen === 'final' && (
          <div className="screen active">
            <div className="title">Workout Complete!</div>
            <div className="final-subtitle text-center">
              {mode === 'reps'
                ? `You completed ${total} reps with ${restSeconds}s rest between each.`
                : `You completed ${total} sets of ${holdSeconds}s holds with ${restSeconds}s rest between each.`}
            </div>
            <div className="btn-group">
              <button className="glass-btn" onClick={restart}>
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
