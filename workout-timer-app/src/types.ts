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
  load?: string // free text, optional (e.g. "10 x 2", "12 kg")
}

export interface RoutineState {
  exercises: Exercise[]
  currentExerciseIndex: number
  isRunning: boolean
}
