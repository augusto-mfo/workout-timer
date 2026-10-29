// Workout Timer App Types

export type WorkoutMode = 'reps' | 'timed'
export type ScreenId = 'setup' | 'rep' | 'exercise' | 'rest' | 'final'

export interface Exercise {
  id: string
  name: string
  type: WorkoutMode
  reps?: number
  restBetweenReps?: number
  sets?: number
  holdTime?: number
  restBetweenSets?: number
  repetitions?: number // optional, rep-based exercises only
  load?: string // free text, optional (e.g. "10 x 2", "12 kg")
}

export interface Plan {
  id: string
  name: string
  exercises: Exercise[]
}

export interface PlansState {
  plans: Plan[]
  activeId: string
}

export interface RoutineState {
  currentExerciseIndex: number
  isRunning: boolean
}

// Config for the sliding top modal (replaces window.confirm / prompt / alert)
export interface DialogConfig {
  title: string
  message?: string
  /** Show a text field; its trimmed value is passed to onConfirm */
  input?: { label: string; defaultValue?: string; placeholder?: string; maxLength?: number; required?: boolean }
  confirmLabel?: string
  /** Cancel button text. `null` hides it (alert-style dialog with a single OK) */
  cancelLabel?: string | null
  /** Style the confirm button as destructive; focus starts on Cancel */
  danger?: boolean
  onConfirm?: (value: string) => void
  onCancel?: () => void
}
