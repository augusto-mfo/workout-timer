# Workout Timer — Agent Notes

This repo contains a single file: **`index.html`**. There is no build step, no dependencies, no tests.

## Architecture

- **Single file**: All HTML, CSS, and JavaScript are inline in `index.html`.
- **No build step**: Open directly in a browser (`file://`).
- **Screen-based navigation**: 5 screens managed via `.screen` / `.screen.active` CSS classes.

## Screens

| Screen | ID | Purpose |
|--------|-----|---------|
| Setup | `setup-screen` | Mode selector + input fields |
| Reps | `rep-screen` | Rep mode — shows rep count, Done + Back buttons |
| Exercise | `exercise-screen` | Timed mode — shows hold timer, Start + Back buttons |
| Rest | `rest-screen` | Circular countdown timer + Skip Rest |
| Final | `final-screen` | Completion summary + Start Over |

## Two Modes

### Reps Mode
- Config: number of reps + rest between reps
- Flow: Rep screen → Done → Rest timer → next Rep → ... → Final

### Timed Exercise Mode
- Config: number of sets + hold time + rest between sets
- Flow: Exercise screen → Start → countdown → Rest timer → next set → ... → Final
- Use case: Isometric holds (plank, wall sit, etc.)

## Visual Design (v2 — Glassmorphism)

### Framework
- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`) — utility classes for layout
- Custom CSS for glassmorphism effects

### Background
- Animated gradient (`gradientShift` keyframes, 15s loop)
- Colors: dark purple → blue → indigo (#0f0c29, #302b63, #24243e, #1a1a2e, #0f3460, #16213e)
- 3 glow orbs with `pulse-glow` animation (blue, purple, cyan)

### Glassmorphism Components

#### Main Container (`.glass`)
- `backdrop-filter: blur(20px)` with `rgba(255,255,255,0.05)` background
- Semi-transparent border, large border-radius (1.5rem)
- Box shadow with inset highlight

#### Buttons (`.glass-btn`)
- Base: `backdrop-filter: blur(10px)`, rgba background, border
- Hover: `translateY(-1px)`, increased brightness, shadow
- Active: `translateY(0)`, slight dim

#### Button Variants
- `.glass-btn-primary` — blue tint (rgba 59,130,246) — Start, Skip Rest
- `.glass-btn-done` — red tint (rgba 239,68,68) — Done
- `.glass-btn-exercise` — green tint (rgba 34,197,94) — Start exercise
- Default — neutral glass — Back to Start, Start Over

#### Inputs (`.glass-input`)
- `backdrop-filter: blur(8px)`, rgba background
- Focus: blue border ring, increased brightness

#### Mode Selector (`.mode-btn`)
- Glass style with active state having blue glow
- Flex row with `gap: 0.75rem`

#### Layout
- `.btn-group` — flex column, `gap: 0.75rem`
- `.section-label` — custom label styling (0.875rem, slate-400)
- `.mode-section` — `display: none !important` / `display: block !important` for mode switching

### Timer
- SVG circle with `stroke-dasharray`/`stroke-dashoffset` for countdown animation
- Color gradient: green → yellow → orange → red based on percentage
- Shared by both exercise and rest timers (`.timer-container`, `.timer-svg`, `.timer-progress`, `.timer-text`)

### Titles
- `.title` — 2rem bold, white with text shadow
- `.rep-info` — 2rem bold, white
- `.exercise-info` — 1.5rem bold, white
- `.final-subtitle` — 1.125rem, slate-400, line-height 1.6

## JavaScript State

| Variable | Description |
|----------|-------------|
| `workoutMode` | `'reps'` or `'timed'` |
| `totalReps` / `totalSets` | Total count for current mode |
| `currentRep` / `currentSet` | Current position |
| `restSeconds` / `holdSeconds` | Timer durations |
| `restInterval` / `exerciseInterval` | Active `setInterval` handles |
| `exerciseRunning` | Flag to prevent double-start |

## Key Functions

| Function | Purpose |
|----------|---------|
| `showScreen(id)` | Toggle `.active` on screens |
| `selectMode(mode)` | Switch between Reps and Timed Exercise |
| `startWorkout()` | Validate inputs, initialize state, show first screen |
| `showRepScreen()` | Display current rep info |
| `doneRep()` | Handle rep completion → final or rest |
| `showExerciseScreen()` | Reset exercise timer, show set info |
| `startExercise()` | Begin hold countdown |
| `startRestTimer()` | Begin rest countdown |
| `skipRest()` | Skip rest, advance to next rep/set |
| `getTimerColor(percentage)` | Green → Yellow → Red gradient |
| `showFinalScreen()` | Display completion summary |
| `restart()` | Clear intervals, reset state, go to setup |

## Agent Directives

| Directive | Value | Description |
|-----------|-------|-------------|
| `external_directory` | `deny` | Do not access or modify files outside this repository. |

## To Modify
- **React app (current):** Edit `workout-timer-app/src/App.tsx` — all logic, UI, and state management lives here.
- **Legacy (do not touch):** `index.html` at the root is a prior v1 static file, not used by the React build.

---

# React App Architecture

Source: `workout-timer-app/src/App.tsx`

## Screens

| Screen | State Value | Purpose |
|--------|-------------|---------|
| Setup | `'setup'` | Mode selector + input fields |
| Reps | `'rep'` | Rep count + Done + Back buttons |
| Exercise | `'exercise'` | Hold timer (SVG) + Start + Back buttons |
| Rest | `'rest'` | Circular countdown + Skip Rest |
| Final | `'final'` | Summary + Start Over |

## Two Modes

### Reps Mode
- Config: number of reps + rest between reps
- Flow: Rep screen → Done → Rest timer → next Rep → ... → Final

### Timed Exercise Mode
- Config: number of sets + hold time + rest between sets
- Flow: Exercise screen → Start → countdown → Rest timer → next set → ... → Final
- Use case: Isometric holds (plank, wall sit, etc.)

## State Variables

| Variable | Type | Description |
|----------|------|-------------|
| `mode` | `WorkoutMode` | `'reps'` or `'timed'` |
| `screen` | `ScreenId` | Current screen identifier |
| `total` | `number` | Total reps or sets |
| `current` | `number` | Current rep/set position |
| `restSeconds` | `number` | Rest duration |
| `holdSeconds` | `number` | Hold duration |
| `lastReps` | `number` | Last-used reps value (persisted) |
| `lastRest` | `number` | Last-used rest (reps mode) |
| `lastSets` | `number` | Last-used sets value (persisted) |
| `lastHold` | `number` | Last-used hold value (persisted) |
| `lastTimedRest` | `number` | Last-used rest (timed mode) |
| `exerciseRemaining` | `number` | Exercise hold countdown |
| `restRemaining` | `number` | Rest countdown |
| `exerciseRunning` | `boolean` | Prevent double-start |

## Key Functions

| Function | Purpose |
|----------|---------|
| `showScreen(id)` | Set the active screen |
| `selectMode(mode)` | Switch between Reps and Timed Exercise |
| `startWorkout()` | Validate inputs, save last-used values, initialize state |
| `startCountdown(totalSec, setRemaining, onEnd)` | Generic countdown with interval |
| `showRepScreen()` | Show current rep info |
| `doneRep()` | Complete rep → rest timer |
| `showExerciseScreen()` | Reset exercise timer, show set info |
| `startExercise()` | Begin hold countdown |
| `startRestTimer()` | Begin rest countdown |
| `skipRest()` | Skip rest, advance to next rep/set |
| `finishRest()` | Navigate to next rep/set or final screen |
| `getTimerColor(percentage)` | Green → Yellow → Red gradient |
| `showFinalScreen()` | Display completion summary |
| `restart()` | Clear intervals, reset state, go to setup |
| `restoreInputs()` | Populate input fields from last-used values (or defaults) |

## Last-Used Value Persistence

Input fields retain the values from the most recent workout when restarting. Defaults are only applied on the very first page load.

- **Defaults:** 10 reps, 30s rest, 5 sets, 30s hold, 30s timed rest
- **Behavior:** Once a workout is started, those values are saved to state (`lastReps`, `lastRest`, etc.) and restored on every restart via `restoreInputs()`.
- **Implementation:** A `useEffect` watches for `screen === 'setup'` and calls `restoreInputs()` after the input elements are rendered.
