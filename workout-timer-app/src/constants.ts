// Workout Timer App Constants

// SVG Timer Constants
export const CIRCLE_RADIUS = 80
export const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

// Storage Keys
// v1: a single routine (array of exercises). Kept only so it can be migrated.
export const STORAGE_KEY = 'workout-timer:routine:v1'
// v2: multiple plans + which one is active
export const PLANS_KEY = 'workout-timer:plans:v2'

// UI preferences (e.g. collapsed left panel)
export const UI_KEY = 'workout-timer:ui:v1'
