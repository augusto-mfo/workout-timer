import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ──
type WorkoutMode = 'reps' | 'timed'
type ScreenId = 'setup' | 'rep' | 'exercise' | 'rest' | 'final'
type RoutineState = {
  exercises: Exercise[]
  currentExerciseIndex: number
  isRunning: boolean
}

interface Exercise {
  id: string
  name: string
  type: WorkoutMode
  reps?: number
  restBetweenReps?: number
  sets?: number
  holdTime?: number
  restBetweenSets?: number
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
const STORAGE_KEY = 'workout-timer:routine:v1'

function loadExercises(): Exercise[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string' && (e.type === 'reps' || e.type === 'timed'))
      : []
  } catch {
    return []
  }
}

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

const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

// ── Main App Component ──
export default function App() {
  // ── State ──
  const [mode, setMode] = useState<WorkoutMode>('reps')
  const [screen, setScreen] = useState<ScreenId>('setup')
  const [total, setTotal] = useState(0)
  const [current, setCurrent] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [holdSeconds, setHoldSeconds] = useState(0)

  // Routine state
  const [routine, setRoutine] = useState<RoutineState>(() => ({
    exercises: loadExercises(),
    currentExerciseIndex: 0,
    isRunning: false,
  }))

  // Keep the routine across page reloads
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routine.exercises))
    } catch {
      /* storage unavailable – ignore */
    }
  }, [routine.exercises])

  // Last-used values (persisted across restarts)
  const [lastReps, setLastReps] = useState(10)
  const [lastRest, setLastRest] = useState(30)
  const [lastSets, setLastSets] = useState(5)
  const [lastHold, setLastHold] = useState(30)
  const [lastTimedRest, setLastTimedRest] = useState(30)

  // Input refs
  const repsRef = useRef<HTMLInputElement>(null)
  const restRef = useRef<HTMLInputElement>(null)
  const setsRef = useRef<HTMLInputElement>(null)
  const holdRef = useRef<HTMLInputElement>(null)
  const timedRestRef = useRef<HTMLInputElement>(null)
  const exerciseNameRef = useRef<HTMLInputElement>(null)

  const getNum = (el: HTMLInputElement | null, fallback = 0) =>
    parseInt(el?.value ?? String(fallback), 10)

  // Restore input values from last-used state (or defaults on first load)
  const restoreInputs = useCallback(() => {
    if (mode === 'reps') {
      if (repsRef.current) repsRef.current.value = String(lastReps)
      if (restRef.current) restRef.current.value = String(lastRest)
    } else {
      if (setsRef.current) setsRef.current.value = String(lastSets)
      if (holdRef.current) holdRef.current.value = String(lastHold)
      if (timedRestRef.current) timedRestRef.current.value = String(lastTimedRest)
    }
  }, [mode, lastReps, lastRest, lastSets, lastHold, lastTimedRest])

  // Timer state
  const [exerciseRemaining, setExerciseRemaining] = useState(0)
  const [restRemaining, setRestRemaining] = useState(0)
  const [exerciseRunning, setExerciseRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Type of the exercise currently being run (independent from the setup form's `mode`)
  const [activeType, setActiveType] = useState<WorkoutMode>('reps')

  // Refs to avoid stale closures in interval callbacks
  const currentRef = useRef(current)
  const totalRef = useRef(total)
  const activeTypeRef = useRef(activeType)
  const routineRef = useRef(routine)
  currentRef.current = current
  totalRef.current = total
  activeTypeRef.current = activeType
  routineRef.current = routine

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Initialize input values on mount ──
  useEffect(() => {
    restoreInputs()
  }, [restoreInputs])

  // ── Mode Selection ──
  const selectMode = (m: WorkoutMode) => setMode(m)

  // ── Routine Management ──
  const addExercise = () => {
    const name = exerciseNameRef.current?.value.trim() ?? ''
    if (!name) {
      alert('Please enter an exercise name.')
      return
    }

    let newExercise: Exercise
    if (mode === 'reps') {
      const reps = getNum(repsRef.current, 10)
      const rest = getNum(restRef.current, 30)
      if (!validate(reps, 'reps') || !validate(rest, 'rest')) return
      newExercise = {
        id: Date.now().toString(),
        name,
        type: 'reps',
        reps,
        restBetweenReps: rest,
      }
    } else {
      const sets = getNum(setsRef.current, 5)
      const hold = getNum(holdRef.current, 30)
      const rest = getNum(timedRestRef.current, 30)
      if (!validate(sets, 'sets') || !validate(hold, 'hold time') || !validate(rest, 'rest')) return
      newExercise = {
        id: Date.now().toString(),
        name,
        type: 'timed',
        sets,
        holdTime: hold,
        restBetweenSets: rest,
      }
    }

    setRoutine(prev => ({ ...prev, exercises: [...prev.exercises, newExercise] }))

    // Reset the form after adding
    if (exerciseNameRef.current) exerciseNameRef.current.value = ''
    if (mode === 'reps') {
      if (repsRef.current) repsRef.current.value = '10'
      if (restRef.current) restRef.current.value = '30'
    } else {
      if (setsRef.current) setsRef.current.value = '5'
      if (holdRef.current) holdRef.current.value = '30'
      if (timedRestRef.current) timedRestRef.current.value = '30'
    }
  }

  const removeExercise = (id: string) => {
    setRoutine(prev => ({ ...prev, exercises: prev.exercises.filter(e => e.id !== id) }))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    setRoutine(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.exercises.length) return prev
      const exercises = [...prev.exercises]
      ;[exercises[index], exercises[target]] = [exercises[target], exercises[index]]
      return { ...prev, exercises }
    })
  }

  const clearAllExercises = () => {
    if (routine.exercises.length > 1 && !window.confirm('Remove all exercises from the routine?')) return
    setRoutine(prev => ({ ...prev, exercises: [] }))
  }

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // ── Load one exercise from the routine into the workout screens ──
  const beginExercise = (ex: Exercise, index: number) => {
    stopTimer()
    setActiveType(ex.type)
    setExerciseRunning(false)
    setRoutine(prev => ({ ...prev, currentExerciseIndex: index, isRunning: true }))
    setCurrent(1)
    if (ex.type === 'reps') {
      setTotal(ex.reps ?? 10)
      setRestSeconds(ex.restBetweenReps ?? 30)
      setScreen('rep')
    } else {
      const hold = ex.holdTime ?? 30
      setTotal(ex.sets ?? 5)
      setHoldSeconds(hold)
      setRestSeconds(ex.restBetweenSets ?? 30)
      setExerciseRemaining(hold)
      setScreen('exercise')
    }
  }

  // ── Start Routine ──
  const startRoutine = () => {
    if (routine.exercises.length === 0) {
      alert('Please add at least one exercise to the routine.')
      return
    }
    beginExercise(routine.exercises[0], 0)
  }

  // ── Start Single Workout (uses the form values directly) ──
  const startWorkout = () => {
    stopTimer()
    setRoutine(prev => ({ ...prev, isRunning: false, currentExerciseIndex: 0 }))
    setActiveType(mode)
    setExerciseRunning(false)
    if (mode === 'reps') {
      const repsVal = getNum(repsRef.current, 10)
      const restVal = getNum(restRef.current, 30)
      if (!validate(repsVal, 'reps') || !validate(restVal, 'rest')) return
      setTotal(repsVal)
      setRestSeconds(restVal)
      setLastReps(repsVal)
      setLastRest(restVal)
      setCurrent(1)
      setScreen('rep')
    } else {
      const setsVal = getNum(setsRef.current, 5)
      const holdVal = getNum(holdRef.current, 30)
      const timedRestVal = getNum(timedRestRef.current, 30)
      if (!validate(setsVal, 'sets') || !validate(holdVal, 'hold time') || !validate(timedRestVal, 'rest')) return
      setTotal(setsVal)
      setHoldSeconds(holdVal)
      setRestSeconds(timedRestVal)
      setLastSets(setsVal)
      setLastHold(holdVal)
      setLastTimedRest(timedRestVal)
      setCurrent(1)
      setExerciseRemaining(holdVal)
      setScreen('exercise')
    }
  }

  // ── Countdown Logic ──
  const startCountdown = (
    totalSec: number,
    setRemaining: React.Dispatch<React.SetStateAction<number>>,
    onEnd: () => void
  ) => {
    let remaining = totalSec
    setRemaining(remaining)
    stopTimer()
    intervalRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        stopTimer()
        onEnd()
      } else {
        setRemaining(remaining)
      }
    }, 1000)
  }

  // ── Move on to next exercise of the routine, or finish ──
  const goToNextExerciseOrFinish = () => {
    const r = routineRef.current
    if (r.isRunning) {
      const nextIndex = r.currentExerciseIndex + 1
      if (nextIndex < r.exercises.length) {
        beginExercise(r.exercises[nextIndex], nextIndex)
        return
      }
    }
    setScreen('final')
  }

  // ── Rest Timer ──
  const startRestTimer = () => {
    setRestRemaining(restSeconds)
    setScreen('rest')
    // Call through `latest` so the interval never runs a stale finishRest
    startCountdown(restSeconds, setRestRemaining, () => latest.current.finishRest())
  }

  const finishRest = () => {
    if (activeTypeRef.current === 'reps') {
      // `current` was already incremented in doneRep
      if (currentRef.current > totalRef.current) {
        goToNextExerciseOrFinish()
      } else {
        setScreen('rep')
      }
    } else {
      if (currentRef.current >= totalRef.current) {
        goToNextExerciseOrFinish()
      } else {
        setCurrent(prev => prev + 1)
        setExerciseRunning(false)
        setExerciseRemaining(holdSeconds)
        setScreen('exercise')
      }
    }
  }

  const skipRest = () => {
    stopTimer()
    finishRest()
  }

  // Always points at the newest closures (used by timers)
  const latest = useRef({ finishRest, startRestTimer })
  latest.current = { finishRest, startRestTimer }

  // ── Rep Screen ──
  const doneRep = () => {
    setCurrent(prev => prev + 1)
    startRestTimer()
  }

  // ── Start Exercise (timed hold) ──
  const startExercise = () => {
    setExerciseRunning(true)
    startCountdown(holdSeconds, setExerciseRemaining, () => latest.current.startRestTimer())
  }

  // ── Stop (asks first when a routine is in progress) ──
  const stopWorkout = () => {
    if (routine.isRunning && !window.confirm('Stop the routine and go back to setup?')) return
    restart()
  }

  // ── Restart ──
  const restart = () => {
    stopTimer()
    setExerciseRunning(false)
    setCurrent(0)
    setTotal(0)
    setScreen('setup')
    setRoutine(prev => ({ ...prev, isRunning: false, currentExerciseIndex: 0 }))
  }

  // ── Restore inputs when switching to setup screen ──
  useEffect(() => {
    if (screen === 'setup') {
      restoreInputs()
    }
  }, [screen, restoreInputs])

  // ── Render Helpers ──
  const isExerciseActive = screen === 'exercise' && exerciseRunning

  // ── Render ──
  const exerciseSummary = (ex: Exercise) =>
    ex.type === 'reps'
      ? `${ex.reps} reps · ${ex.restBetweenReps}s rest`
      : `${ex.sets} sets · ${ex.holdTime}s hold · ${ex.restBetweenSets}s rest`

  const count = routine.exercises.length
  const exercisesLabel = `${count} exercise${count === 1 ? '' : 's'}`
  const currentEx = routine.exercises[routine.currentExerciseIndex]
  const nextEx = routine.exercises[routine.currentExerciseIndex + 1]
  const progressPct = routine.isRunning && count > 0
    ? Math.round(((screen === 'final' ? count : routine.currentExerciseIndex) / count) * 100)
    : 0

  // What comes after the current rest
  const upNext = (() => {
    const lastStep = activeType === 'reps' ? current > total : current >= total
    if (!lastStep) {
      return activeType === 'reps' ? `Rep ${current} of ${total}` : `Set ${current + 1} of ${total}`
    }
    if (routine.isRunning && nextEx) return nextEx.name
    return 'Finish'
  })()

  const runHeader = (
    <div style={{ marginBottom: '0.5rem' }}>
      <div className="run-name">{routine.isRunning ? currentEx?.name : 'Single workout'}</div>
      {routine.isRunning && (
        <>
          <div className="run-sub">Exercise {routine.currentExerciseIndex + 1} of {count}</div>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="app">
      {/* Glow Orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <div className="glow-orb glow-orb-3" />

      <div className="layout">
        {/* ── Left Panel: add-exercise form (setup) / progress (running) ── */}
        <aside className="glass panel panel-left">
          {screen === 'setup' ? (
            <>
              <h2 className="panel-title">Add Exercise</h2>
              <div
                className="form"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') addExercise()
                }}
              >
                <div className="mode-selector" role="group" aria-label="Exercise type">
                  <button className={`mode-btn ${mode === 'reps' ? 'active' : ''}`} aria-pressed={mode === 'reps'} onClick={() => selectMode('reps')}>
                    Reps
                  </button>
                  <button className={`mode-btn ${mode === 'timed' ? 'active' : ''}`} aria-pressed={mode === 'timed'} onClick={() => selectMode('timed')}>
                    Timed
                  </button>
                </div>

                <div className="field">
                  <label htmlFor="exercise-name-input" className="section-label">Exercise name</label>
                  <input
                    ref={exerciseNameRef}
                    type="text"
                    id="exercise-name-input"
                    className="glass-input"
                    placeholder="e.g., Biceps, Plank..."
                    autoComplete="off"
                  />
                </div>

                {/* Reps Mode */}
                <div className={mode === 'reps' ? 'mode-section active' : 'mode-section'}>
                  <div className="field">
                    <label htmlFor="reps-input" className="section-label">Number of reps</label>
                    <input ref={repsRef} type="number" inputMode="numeric" id="reps-input" min="1" className="glass-input" defaultValue="10" onFocus={selectOnFocus} />
                  </div>
                  <div className="field">
                    <label htmlFor="rest-input" className="section-label">Rest between reps (seconds)</label>
                    <input ref={restRef} type="number" inputMode="numeric" id="rest-input" min="1" className="glass-input" defaultValue="30" onFocus={selectOnFocus} />
                  </div>
                </div>

                {/* Timed Exercise Mode */}
                <div className={mode === 'timed' ? 'mode-section active' : 'mode-section'}>
                  <div className="field">
                    <label htmlFor="sets-input" className="section-label">Number of sets</label>
                    <input ref={setsRef} type="number" inputMode="numeric" id="sets-input" min="1" className="glass-input" defaultValue="5" onFocus={selectOnFocus} />
                  </div>
                  <div className="field">
                    <label htmlFor="hold-input" className="section-label">Hold time (seconds)</label>
                    <input ref={holdRef} type="number" inputMode="numeric" id="hold-input" min="1" className="glass-input" defaultValue="30" onFocus={selectOnFocus} />
                  </div>
                  <div className="field">
                    <label htmlFor="timed-rest-input" className="section-label">Rest between sets (seconds)</label>
                    <input ref={timedRestRef} type="number" inputMode="numeric" id="timed-rest-input" min="1" className="glass-input" defaultValue="30" onFocus={selectOnFocus} />
                  </div>
                </div>

                <div className="stack">
                  <button className="glass-btn glass-btn-primary" onClick={addExercise}>
                    + Add to Routine
                  </button>
                  <button className="glass-btn glass-btn-ghost" onClick={startWorkout}>
                    Just run this one now
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="panel-title">Routine</h2>
              {routine.isRunning ? (
                <ol className="ex-list">
                  {routine.exercises.map((exercise, index) => {
                    const state = screen === 'final' || index < routine.currentExerciseIndex
                      ? 'done'
                      : index === routine.currentExerciseIndex ? 'current' : ''
                    return (
                      <li key={exercise.id} className={`ex-card ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                        <span className="ex-index">{state === 'done' ? '✓' : index + 1}</span>
                        <div className="ex-body">
                          <div className="ex-name">{exercise.name}</div>
                          <div className="ex-meta">{exerciseSummary(exercise)}</div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="muted">{screen === 'final' ? 'Workout complete.' : 'Single workout in progress.'}</p>
              )}
            </>
          )}
        </aside>

        {/* ── Right Panel ── */}
        <main className="glass panel panel-right">
          {/* ── Setup / routine overview ── */}
          {screen === 'setup' && (
            <div className="screen active">
              <div className="title">Your Routine</div>

              {count === 0 ? (
                <div className="empty-state">
                  Your routine is empty.<br />
                  Add your first exercise using the form, then start the routine from here.
                </div>
              ) : (
                <>
                  <div className="list-header">
                    <h3>{exercisesLabel}</h3>
                    <button className="glass-btn glass-btn-danger glass-btn-sm" onClick={clearAllExercises}>
                      Clear all
                    </button>
                  </div>

                  <ol className="ex-list" style={{ marginBottom: '1.5rem' }}>
                    {routine.exercises.map((exercise, index) => (
                      <li key={exercise.id} className="ex-card">
                        <span className="ex-index">{index + 1}</span>
                        <div className="ex-body">
                          <div className="ex-name">{exercise.name}</div>
                          <div className="ex-meta">
                            <span className={`badge badge-${exercise.type}`}>{exercise.type}</span>
                            {exerciseSummary(exercise)}
                          </div>
                        </div>
                        <div className="ex-actions">
                          <button className="icon-btn" aria-label={`Move ${exercise.name} up`} title="Move up" disabled={index === 0} onClick={() => moveExercise(index, -1)}>↑</button>
                          <button className="icon-btn" aria-label={`Move ${exercise.name} down`} title="Move down" disabled={index === count - 1} onClick={() => moveExercise(index, 1)}>↓</button>
                          <button className="icon-btn danger" aria-label={`Remove ${exercise.name}`} title="Remove" onClick={() => removeExercise(exercise.id)}>✕</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <button className="glass-btn glass-btn-primary" onClick={startRoutine} disabled={count === 0}>
                ▶ Start Routine{count > 0 ? ` (${exercisesLabel})` : ''}
              </button>
            </div>
          )}

          {/* ── Rep Screen ── */}
          {screen === 'rep' && (
            <div className="screen active center">
              {runHeader}
              <div className="rep-info">Rep {current} of {total}</div>
              <div className="btn-group">
                <button className="glass-btn glass-btn-exercise" onClick={doneRep}>Done</button>
                <button className="glass-btn glass-btn-ghost" onClick={stopWorkout}>Stop &amp; back to setup</button>
              </div>
            </div>
          )}

          {/* ── Exercise Screen ── */}
          {screen === 'exercise' && (
            <div className="screen active center">
              {runHeader}
              <div className="exercise-label">Hold</div>
              <div className="exercise-info">Set {current} of {total}</div>
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
                  <button className="glass-btn glass-btn-exercise" onClick={startExercise}>Start</button>
                )}
                <button className="glass-btn glass-btn-ghost" onClick={stopWorkout}>Stop &amp; back to setup</button>
              </div>
            </div>
          )}

          {/* ── Rest Screen ── */}
          {screen === 'rest' && (
            <div className="screen active center">
              {runHeader}
              <div className="exercise-label">Rest</div>
              <SVGTimer
                totalSeconds={restSeconds}
                remainingSeconds={restRemaining}
                circleId="rest-timer-circle"
                textId="rest-timer-text"
                onEnd={finishRest}
                active
              />
              <p className="up-next">Up next: <strong>{upNext}</strong></p>
              <div className="btn-group">
                <button className="glass-btn glass-btn-primary" onClick={skipRest}>Skip rest</button>
                <button className="glass-btn glass-btn-ghost" onClick={stopWorkout}>Stop &amp; back to setup</button>
              </div>
            </div>
          )}

          {/* ── Final Screen ── */}
          {screen === 'final' && (
            <div className="screen active center">
              <div className="title">Workout Complete! 🎉</div>
              <div className="final-subtitle">
                {routine.isRunning
                  ? `You completed all ${exercisesLabel} in your routine.`
                  : activeType === 'reps'
                    ? `You completed ${total} reps with ${restSeconds}s rest between each.`
                    : `You completed ${total} sets of ${holdSeconds}s holds with ${restSeconds}s rest between each.`}
              </div>
              <div className="btn-group">
                {routine.isRunning && (
                  <button className="glass-btn glass-btn-primary" onClick={startRoutine}>Repeat routine</button>
                )}
                <button className="glass-btn" onClick={restart}>Back to setup</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
