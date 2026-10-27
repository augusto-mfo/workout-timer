# CRITICAL: Project Structure — Never Edit Root `index.html`

## The React App Is Here
**Working directory for all edits:** `workout-timer-app/`

- Source code: `workout-timer-app/src/`
  - `App.tsx` — main React component (all screens, logic, SVG timer)
  - `main.tsx` — React entry point
  - `index.css` — all styles (glassmorphism, animations, layout)
- Build output: `workout-timer-app/dist/`
- Config: `workout-timer-app/vite.config.ts`, `package.json`, `tsconfig.json`

## What NOT to Touch
- `index.html` at the **root** (`C:\Users\Augusto\source\repos\workout-timer\index.html`)
  - This is a **legacy static HTML file** from a prior version (v1).
  - It is **NOT** the application. It is not used by the React build.
  - **NEVER** edit, modify, or touch this file.

## How to Run / Build
```bash
cd workout-timer-app
npm run dev    # development server (Vite)
npm run build  # production build
```

## Screen Map (React App)
| Screen | State Value | Component |
|--------|-------------|-----------|
| Setup | `'setup'` | Mode selector + input fields |
| Reps | `'rep'` | Rep count + Done + Back buttons |
| Exercise | `'exercise'` | Hold timer (SVG) + Start + Back buttons |
| Rest | `'rest'` | Circular countdown + Skip Rest |
| Final | `'final'` | Summary + Start Over |

## Two Modes
- **Reps mode**: Config reps + rest → Rep screen → Done → Rest → next rep → ... → Final
- **Timed mode**: Config sets + hold + rest → Exercise screen → Start → countdown → Rest → next set → ... → Final

## Key File
**`workout-timer-app/src/App.tsx`** — this is the single source of truth. All logic, UI, and state management lives here.

## Last-Used Value Persistence (Recent Change)
Input fields retain the values from the most recent workout when restarting. Defaults are only applied on the very first page load.

- **Defaults:** 10 reps, 30s rest, 5 sets, 30s hold, 30s timed rest
- **Implementation:** `lastReps`, `lastRest`, `lastSets`, `lastHold`, `lastTimedRest` state variables store the last-used values. A `useEffect` watching `screen === 'setup'` calls `restoreInputs()` to populate the fields after they render.
- **Saved in:** `startWorkout()` — values are persisted when a workout starts.
- **Restored in:** `restart()` → `restoreInputs()` — called via effect when navigating back to setup.
