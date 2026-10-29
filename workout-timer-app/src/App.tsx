import { useState, useRef, useEffect } from 'react'
import type { WorkoutMode, ScreenId, RoutineState, Exercise, Plan, PlansState, DialogConfig } from './types'
import { CIRCLE_RADIUS, CIRCLE_CIRCUMFERENCE, STORAGE_KEY, PLANS_KEY, UI_KEY } from './constants'
import { SVGTimer } from './components/SVGTimer'
import { Slider } from './components/Slider'
import { TopModal } from './components/TopModal'
import { formatSeconds, plural } from './helpers'

// ── Validation / persistence ──

const newPlanId = () => `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

function sanitizeExercises(parsed: unknown): Exercise[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((e) => e && typeof e.id === 'string' && typeof e.name === 'string' && (e.type === 'reps' || e.type === 'timed'))
    .map(({ weight, ...e }) => ({
      ...e,
      repetitions: e.type === 'reps' && Number.isInteger(e.repetitions) && e.repetitions > 0 ? e.repetitions : undefined,
      // migrate the old numeric `weight` field
      load: typeof e.load === 'string' ? e.load : typeof weight === 'number' ? `${weight} kg` : undefined,
    }))
}

const emptyPlan = (name = 'My plan'): Plan => ({ id: newPlanId(), name, exercises: [] })

function loadPlans(): PlansState {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.plans)) {
        const plans: Plan[] = parsed.plans
          .filter((p: Plan) => p && typeof p.id === 'string' && typeof p.name === 'string')
          .map((p: Plan) => ({ id: p.id, name: p.name, exercises: sanitizeExercises(p.exercises) }))
        if (plans.length > 0) {
          const activeId = plans.some(p => p.id === parsed.activeId) ? parsed.activeId : plans[0].id
          return { plans, activeId }
        }
      }
    }
  } catch {
    /* fall through to migration / defaults */
  }

  // First run with multi-plan support: carry over the old single routine (if any) as the first plan
  let legacy: Exercise[] = []
  try {
    const rawLegacy = localStorage.getItem(STORAGE_KEY)
    legacy = rawLegacy ? sanitizeExercises(JSON.parse(rawLegacy)) : []
  } catch {
    legacy = []
  }
  const first: Plan = { ...emptyPlan(), exercises: legacy }
  return { plans: [first], activeId: first.id }
}

// ── SVG Timer Component ──
// Moved to src/components/SVGTimer.tsx

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
  const [routine, setRoutine] = useState<RoutineState>({ currentExerciseIndex: 0, isRunning: false })

  // Plans: several named routines, one of them active
  const [plansState, setPlansState] = useState<PlansState>(loadPlans)
  const activePlan = plansState.plans.find(p => p.id === plansState.activeId) ?? plansState.plans[0]
  const exercises = activePlan.exercises

  // Keep the plans across page reloads
  useEffect(() => {
    try {
      localStorage.setItem(PLANS_KEY, JSON.stringify(plansState))
    } catch {
      /* storage unavailable – ignore */
    }
  }, [plansState])

  // Update the exercises of the active plan
  const updateExercises = (fn: (prev: Exercise[]) => Exercise[]) =>
    setPlansState(ps => ({
      ...ps,
      plans: ps.plans.map(p => (p.id === ps.activeId ? { ...p, exercises: fn(p.exercises) } : p)),
    }))

  // Setup form (controlled, so sliders can show live values)
  const [name, setName] = useState('')
  const [load, setLoad] = useState('')
  const [repetitions, setRepetitions] = useState('')
  const [form, setForm] = useState({ reps: 10, rest: 30, sets: 5, hold: 30, timedRest: 30 })
  const setField = (key: keyof typeof form) => (value: number) => setForm(f => ({ ...f, [key]: value }))
  const nameInputRef = useRef<HTMLInputElement>(null)
  const asideRef = useRef<HTMLElement>(null)

  // Id of the exercise currently loaded in the form for editing (null = adding a new one)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Left panel can be collapsed; remembered across reloads
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem(UI_KEY) ?? '{}').leftCollapsed === true
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ leftCollapsed }))
    } catch {
      /* storage unavailable – ignore */
    }
  }, [leftCollapsed])
  const [singleLoad, setSingleLoad] = useState<string | undefined>(undefined)
  const [singleRepetitions, setSingleRepetitions] = useState<number | undefined>(undefined)

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
  const exercisesRef = useRef(exercises)
  currentRef.current = current
  totalRef.current = total
  activeTypeRef.current = activeType
  routineRef.current = routine
  exercisesRef.current = exercises

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Mode Selection ──
  const selectMode = (m: WorkoutMode) => setMode(m)

  // Optional positive whole number from the repetitions field
  const parseRepetitions = () => {
    const n = parseInt(repetitions, 10)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }

  // ── Dialogs (sliding top modal) ──
  const [dialog, setDialog] = useState<DialogConfig | null>(null)
  const closeDialog = () => setDialog(null)

  // ── Plan Management ──
  const selectPlan = (id: string) => setPlansState(ps => ({ ...ps, activeId: id }))

  const createPlan = () => {
    const fallback = `Plan ${plansState.plans.length + 1}`
    setDialog({
      title: 'New plan',
      input: { label: 'Plan name', defaultValue: fallback, placeholder: 'e.g., Upper body' },
      confirmLabel: 'Create',
      onConfirm: value => {
        const plan = emptyPlan(value || fallback)
        setPlansState(ps => ({ plans: [...ps.plans, plan], activeId: plan.id }))
      },
    })
  }

  const renamePlan = () => {
    const targetId = activePlan.id
    setDialog({
      title: 'Rename plan',
      input: { label: 'Plan name', defaultValue: activePlan.name, required: true },
      confirmLabel: 'Rename',
      onConfirm: name =>
        setPlansState(ps => ({
          ...ps,
          plans: ps.plans.map(p => (p.id === targetId ? { ...p, name } : p)),
        })),
    })
  }

  const deletePlan = () => {
    const n = activePlan.exercises.length
    const detail = n > 0 ? ` and its ${plural(n, 'exercise')}` : ''
    const targetId = activePlan.id
    setDialog({
      title: 'Delete plan?',
      message: `Delete the plan "${activePlan.name}"${detail}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () =>
        setPlansState(ps => {
          const idx = ps.plans.findIndex(p => p.id === targetId)
          const remaining = ps.plans.filter(p => p.id !== targetId)
          // Deleting the last plan leaves a fresh empty one so the app always has an active plan
          if (remaining.length === 0) {
            const fresh = emptyPlan()
            return { plans: [fresh], activeId: fresh.id }
          }
          const nextActive = ps.activeId === targetId ? remaining[Math.min(idx, remaining.length - 1)].id : ps.activeId
          return { plans: remaining, activeId: nextActive }
        }),
    })
  }

  // ── Routine Management ──
  const addExercise = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setDialog({
        title: 'Exercise name needed',
        message: 'Please enter an exercise name.',
        cancelLabel: null,
        onConfirm: () => nameInputRef.current?.focus(),
      })
      return
    }

    const base = { id: Date.now().toString(), name: trimmed, load: load.trim() || undefined }
    const newExercise: Exercise =
      mode === 'reps'
        ? { ...base, type: 'reps', reps: form.reps, restBetweenReps: form.rest, repetitions: parseRepetitions() }
        : { ...base, type: 'timed', sets: form.sets, holdTime: form.hold, restBetweenSets: form.timedRest }

    updateExercises(prev => [...prev, newExercise])

    // Clear the text fields; keep the slider values since consecutive exercises are often similar
    setName('')
    setLoad('')
    setRepetitions('')
    nameInputRef.current?.focus()
  }

  const resetTextFields = () => {
    setName('')
    setLoad('')
    setRepetitions('')
  }

  // Load an exercise into the form so it can be edited
  const startEdit = (ex: Exercise) => {
    setEditingId(ex.id)
    setMode(ex.type)
    setName(ex.name)
    setLoad(ex.load ?? '')
    setRepetitions(ex.repetitions ? String(ex.repetitions) : '')
    setForm(f =>
      ex.type === 'reps'
        ? { ...f, reps: ex.reps ?? f.reps, rest: ex.restBetweenReps ?? f.rest }
        : { ...f, sets: ex.sets ?? f.sets, hold: ex.holdTime ?? f.hold, timedRest: ex.restBetweenSets ?? f.timedRest },
    )
    setLeftCollapsed(false)
    // wait for the form to be (re)rendered, then bring it into view
    setTimeout(() => {
      asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      nameInputRef.current?.focus()
    }, 0)
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetTextFields()
  }

  const saveEdit = () => {
    if (!editingId) return
    const trimmed = name.trim()
    if (!trimmed) {
      setDialog({
        title: 'Exercise name needed',
        message: 'Please enter an exercise name.',
        cancelLabel: null,
        onConfirm: () => nameInputRef.current?.focus(),
      })
      return
    }
    const base = { id: editingId, name: trimmed, load: load.trim() || undefined }
    const updated: Exercise =
      mode === 'reps'
        ? { ...base, type: 'reps', reps: form.reps, restBetweenReps: form.rest, repetitions: parseRepetitions() }
        : { ...base, type: 'timed', sets: form.sets, holdTime: form.hold, restBetweenSets: form.timedRest }
    updateExercises(prev => prev.map(e => (e.id === editingId ? updated : e)))
    cancelEdit()
  }

  const submitForm = () => (editingId ? saveEdit() : addExercise())

  // Stop editing if the exercise disappears (removed, cleared, plan switched or deleted)
  useEffect(() => {
    if (editingId && !exercises.some(e => e.id === editingId)) {
      setEditingId(null)
      setName('')
      setLoad('')
      setRepetitions('')
    }
  }, [exercises, editingId])

  const removeExercise = (id: string) => {
    updateExercises(prev => prev.filter(e => e.id !== id))
  }

  const moveExercise = (index: number, direction: -1 | 1) => {
    updateExercises(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const clearAllExercises = () => {
    const clear = () => updateExercises(() => [])
    if (exercises.length <= 1) return clear()
    setDialog({
      title: 'Clear all exercises?',
      message: `Remove all ${exercises.length} exercises from "${activePlan.name}"?`,
      confirmLabel: 'Clear all',
      danger: true,
      onConfirm: clear,
    })
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
    if (exercises.length === 0) {
      setDialog({
        title: 'Nothing to run',
        message: 'Please add at least one exercise to the plan.',
        cancelLabel: null,
      })
      return
    }
    beginExercise(exercises[0], 0)
  }

  // ── Start Single Workout (uses the form values directly) ──
  const startWorkout = () => {
    stopTimer()
    setSingleLoad(load.trim() || undefined)
    setSingleRepetitions(mode === 'reps' ? parseRepetitions() : undefined)
    setRoutine(prev => ({ ...prev, isRunning: false, currentExerciseIndex: 0 }))
    setActiveType(mode)
    setExerciseRunning(false)
    setCurrent(1)
    if (mode === 'reps') {
      setTotal(form.reps)
      setRestSeconds(form.rest)
      setScreen('rep')
    } else {
      setTotal(form.sets)
      setHoldSeconds(form.hold)
      setRestSeconds(form.timedRest)
      setExerciseRemaining(form.hold)
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
    const list = exercisesRef.current
    if (r.isRunning) {
      const nextIndex = r.currentExerciseIndex + 1
      if (nextIndex < list.length) {
        beginExercise(list[nextIndex], nextIndex)
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
    if (!routine.isRunning) return restart()
    setDialog({
      title: 'Stop the routine?',
      message: 'Go back to setup? Your progress in this run will be lost.',
      confirmLabel: 'Stop',
      cancelLabel: 'Keep going',
      danger: true,
      onConfirm: restart,
    })
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

  // ── Render Helpers ──
  const isExerciseActive = screen === 'exercise' && exerciseRunning

  // ── Render ──
  const exerciseSummary = (ex: Exercise) =>
    (ex.type === 'reps'
      ? `${ex.reps} series${ex.repetitions ? ` × ${plural(ex.repetitions, 'repetition')}` : ''} · ${formatSeconds(ex.restBetweenReps ?? 0)} rest`
      : `${plural(ex.sets, 'set')} · ${formatSeconds(ex.holdTime ?? 0)} hold · ${formatSeconds(ex.restBetweenSets ?? 0)} rest`) +
    (ex.load ? ` · ${ex.load}` : '')

  const count = exercises.length
  const exercisesLabel = `${count} exercise${count === 1 ? '' : 's'}`
  const currentEx = exercises[routine.currentExerciseIndex]
  const nextEx = exercises[routine.currentExerciseIndex + 1]
  const progressPct = routine.isRunning && count > 0
    ? Math.round(((screen === 'final' ? count : routine.currentExerciseIndex) / count) * 100)
    : 0

  // What comes after the current rest
  const upNext = (() => {
    const lastStep = activeType === 'reps' ? current > total : current >= total
    if (!lastStep) {
      return activeType === 'reps' ? `Series ${current} of ${total}` : `Set ${current + 1} of ${total}`
    }
    if (routine.isRunning && nextEx) return nextEx.name
    return 'Finish'
  })()

  const runLoad = routine.isRunning ? currentEx?.load : singleLoad
  const runRepetitions = activeType === 'reps' ? (routine.isRunning ? currentEx?.repetitions : singleRepetitions) : undefined
  const runHeader = (
    <div style={{ marginBottom: '0.5rem' }}>
      <div className="run-name">{routine.isRunning ? currentEx?.name : 'Single workout'}</div>
      {routine.isRunning && (
        <div className="run-sub">Exercise {routine.currentExerciseIndex + 1} of {count}</div>
      )}
      {runLoad && <div className="run-load">Load · {runLoad}</div>}
      {runRepetitions && <div className="run-load">Repetitions · {runRepetitions}</div>}
      {routine.isRunning && (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}>
            <div className="progress-bar" style={{ width: `${progressPct}%` }} />
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="app">
      <TopModal dialog={dialog} onClose={closeDialog} />

      {/* Glow Orbs */}
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <header className="app-header">
        <h1>Simple Workout App</h1>
      </header>

      <div className="plan-bar" role="group" aria-label="Workout plans">
        <select
          className="glass-input plan-select"
          aria-label="Active plan"
          value={activePlan.id}
          disabled={screen !== 'setup'}
          onChange={e => selectPlan(e.target.value)}
        >
          {plansState.plans.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.exercises.length})
            </option>
          ))}
        </select>
        <button className="glass-btn glass-btn-ghost glass-btn-sm" onClick={createPlan} disabled={screen !== 'setup'}>
          + New
        </button>
        <button className="glass-btn glass-btn-ghost glass-btn-sm" onClick={renamePlan} disabled={screen !== 'setup'}>
          Rename
        </button>
        <button className="glass-btn glass-btn-danger glass-btn-sm" onClick={deletePlan} disabled={screen !== 'setup'}>
          Delete
        </button>
      </div>

      <div className="layout">
        {/* ── Left Panel: add-exercise form (setup) / progress (running) ── */}
        <aside ref={asideRef} className={`glass panel panel-left${leftCollapsed ? ' collapsed' : ''}`}>
          <div className="panel-head">
            <h2 className="panel-title">
              {screen === 'setup' ? (editingId ? 'Edit Exercise' : 'Add Exercise') : 'Routine'}
            </h2>
            <button
              className="icon-btn panel-toggle"
              aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
              aria-expanded={!leftCollapsed}
              title={leftCollapsed ? 'Expand' : 'Collapse'}
              onClick={() => setLeftCollapsed(v => !v)}
            >
              {leftCollapsed ? '›' : '‹'}
            </button>
          </div>
          {leftCollapsed ? null : screen === 'setup' ? (
            <>
              <div className="panel-body">
                <div
                  className="form"
                  onKeyDown={e => {
                    const t = e.target as HTMLInputElement
                    if (e.key === 'Enter' && t.tagName === 'INPUT' && t.type === 'text') submitForm()
                  }}
                >
                  <div className="mode-selector" role="group" aria-label="Exercise type">
                    <button className={`mode-btn ${mode === 'reps' ? 'active' : ''}`} aria-pressed={mode === 'reps'} onClick={() => selectMode('reps')}>
                      Repetitions
                    </button>
                    <button className={`mode-btn ${mode === 'timed' ? 'active' : ''}`} aria-pressed={mode === 'timed'} onClick={() => selectMode('timed')}>
                      Timed
                    </button>
                  </div>

                  <div className="field">
                    <label htmlFor="exercise-name-input" className="section-label">Exercise name</label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      id="exercise-name-input"
                      className="glass-input"
                      placeholder="e.g., Biceps, Plank..."
                      autoComplete="off"
                      maxLength={60}
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>

                  {mode === 'reps' ? (
                    <>
                      <Slider id="reps-input" label="Number of series" value={form.reps} min={1} max={50}
                        format={v => `${v} series`} onChange={setField('reps')} />
                      <Slider id="rest-input" label="Rest between series" value={form.rest} min={5} max={120} step={5}
                        format={formatSeconds} onChange={setField('rest')} />
                    </>
                  ) : (
                    <>
                      <Slider id="sets-input" label="Number of sets" value={form.sets} min={1} max={20}
                        format={v => `${v} ${v === 1 ? 'set' : 'sets'}`} onChange={setField('sets')} />
                      <Slider id="hold-input" label="Hold time" value={form.hold} min={5} max={180} step={5}
                        format={formatSeconds} onChange={setField('hold')} />
                      <Slider id="timed-rest-input" label="Rest between sets" value={form.timedRest} min={5} max={180} step={5}
                        format={formatSeconds} onChange={setField('timedRest')} />
                    </>
                  )}

                  {mode === 'reps' && (
                    <div className="field">
                      <label htmlFor="repetitions-input" className="section-label">
                        Repetitions <span className="optional">(optional)</span>
                      </label>
                      <input
                        type="text"
                        id="repetitions-input"
                        className="glass-input"
                        inputMode="numeric"
                        placeholder="e.g., 12"
                        autoComplete="off"
                        maxLength={3}
                        value={repetitions}
                        onChange={e => setRepetitions(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="load-input" className="section-label">
                      Load <span className="optional">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="load-input"
                      className="glass-input"
                      placeholder="e.g., 10 x 2, 12 kg, bodyweight"
                      autoComplete="off"
                      maxLength={40}
                      value={load}
                      onChange={e => setLoad(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="panel-footer">
                {editingId ? (
                  <>
                    <button className="glass-btn glass-btn-primary" onClick={saveEdit}>
                      Save changes
                    </button>
                    <button className="glass-btn glass-btn-ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button className="glass-btn glass-btn-primary" onClick={addExercise}>
                      + Add to Routine
                    </button>
                    <button className="glass-btn glass-btn-ghost" onClick={startWorkout}>
                      Just run this one now
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="panel-body">
              {routine.isRunning ? (
                <ol className="ex-list">
                  {exercises.map((exercise, index) => {
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
            </div>
          )}
        </aside>

        {/* ── Right Panel ── */}
        <main className="glass panel panel-right">
          {/* ── Setup / routine overview ── */}
          {screen === 'setup' && (
            <div className="screen active">
              <div className="title">{activePlan.name}</div>

              {count === 0 ? (
                <div className="empty-state">
                  This plan is empty.<br />
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
                  <p className="hint">Click an exercise to edit it.</p>

                  <ol className="ex-list" style={{ marginBottom: '1.5rem' }}>
                    {exercises.map((exercise, index) => (
                      <li key={exercise.id} className={`ex-card${editingId === exercise.id ? ' editing' : ''}`}>
                        <button
                          type="button"
                          className="ex-main"
                          aria-label={`Edit ${exercise.name}`}
                          title="Click to edit"
                          onClick={() => startEdit(exercise)}
                        >
                          <span className="ex-index">{index + 1}</span>
                          <span className="ex-body">
                            <span className="ex-name">{exercise.name}</span>
                            <span className="ex-meta">
                              <span className={`badge badge-${exercise.type}`}>{exercise.type === 'reps' ? 'repetitions' : 'timed'}</span>
                              {exerciseSummary(exercise)}
                            </span>
                          </span>
                        </button>
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
              <div className="rep-info">Series {current} of {total}</div>
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
                    ? `You completed ${total} series with ${restSeconds}s rest between each.`
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
