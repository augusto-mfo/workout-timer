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

## CSS System

### Base Button
- `.btn` — shared: width 100%, padding 1rem 2rem, font 1.2rem bold, border-radius 8px, filter transition
- Hover: `brightness(1.1)`, Active: `brightness(0.95)`

### Button Variants
- `.btn-primary` — blue (#0f3460) — Start, Skip Rest
- `.btn-done` — red-pink (#e94560) — Done
- `.btn-start-exercise` — green (#22c55e) — Start exercise
- `.btn-restart` — blue (#0f3460) — Back to Start, Start Over

### Layout Containers
- `.rep-buttons`, `.rest-buttons` — flex column with `gap: 0.75rem`
- `.mode-selector` — flex row with `gap: 0.75rem`

### Timer
- SVG circle with `stroke-dasharray`/`stroke-dashoffset` for countdown animation
- Color gradient: green → yellow → orange → red based on percentage
- Shared by both exercise and rest timers (`.timer-container`, `.timer-svg`, `.timer-progress`, `.timer-text`)

### Titles
- `.title` — shared: 1.8rem bold, 1.5rem bottom margin

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
- Edit `index.html` in place — HTML, CSS, and JS are all inline.
- There are no other files, scripts, or configs to worry about.
