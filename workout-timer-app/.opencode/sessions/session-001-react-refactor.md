# Session: Workout Timer React Refactor (Part 1)

## Status
✅ Project scaffolded, dependencies installed, TypeScript compiles, production build passes.

## What Was Done

### 1. Project Setup
- Scaffolded Vite React TypeScript project: `workout-timer-app/`
- Installed: React 19, React DOM, TypeScript, Vite 7, @vitejs/plugin-react
- Updated `tsconfig.json` for JSX (`react-jsx`), relaxed lint rules

### 2. Files Created/Modified

| File | Purpose |
|------|---------|
| `index.html` | Entry point — Tailwind CDN, `<div id="root">` |
| `package.json` | Dependencies: react, react-dom, vite, typescript |
| `tsconfig.json` | React JSX config, no lint strictness |
| `vite.config.ts` | Vite config with React plugin |
| `src/main.tsx` | React entry point, renders `<App />` |
| `src/index.css` | All custom CSS (glassmorphism, animations, timers) |
| `src/App.tsx` | Full React implementation (single component) |

### 3. Deleted Files
- `src/main.ts` (old Vite template)
- `src/counter.ts` (old Vite template)
- `src/style.css` (old Vite template)
- `src/assets/` (old Vite template images)

### 4. Architecture Decisions
- **Single component**: All logic in `App.tsx` using `useState` + `useRef`
- **Refs for inputs**: `useRef<HTMLInputElement>` for form inputs (uncontrolled)
- **Ref for interval**: `useRef<ReturnType<typeof setInterval> | null>` for timer cleanup
- **SVG timer**: Reusable `<SVGTimer>` component with `stroke-dasharray`/`strokeDashoffset`
- **Color gradient**: Identical `getTimerColor()` — green → yellow → red
- **Tailwind**: Loaded via CDN (same as original), custom CSS in `index.css`

### 5. State Variables
- `mode`: `'reps' | 'timed'`
- `screen`: `'setup' | 'rep' | 'exercise' | 'rest' | 'final'`
- `total`, `current`, `restSeconds`, `holdSeconds`
- `exerciseRemaining`, `restRemaining` (timer countdown values)
- `exerciseRunning` (boolean flag)

### 6. Key Functions (React equivalents)
| Original | React |
|----------|-------|
| `showScreen(id)` | `setScreen(id)` |
| `selectMode(mode)` | `setMode(mode)` |
| `startWorkout()` | `startWorkout()` (reads refs) |
| `doneRep()` | `doneRep()` → `startRestTimer()` |
| `showExerciseScreen()` | `showExerciseScreen()` |
| `startCountdown()` | `startCountdown()` (uses refs for intervals) |
| `startExercise()` | `startExercise()` |
| `startRestTimer()` | `startRestTimer()` |
| `skipRest()` | `skipRest()` |
| `finishRest()` | `finishRest()` |
| `showFinalScreen()` | `showFinalScreen()` |
| `restart()` | `restart()` |

### 7. Build Verification
- `npx tsc --noEmit` — ✅ No errors
- `npx vite build` — ✅ 229KB JS, 4KB CSS

## BUG FOUND — Reps Mode: Done Button Skips Rest Timer, Ends Workout Early

### Reproduction
1. Select Reps mode, set 2 reps + 30s rest
2. Click Start → shows "Rep 1 of 2"
3. Click Done → rest timer doesn't start, goes straight to Final screen

### Root Cause — Stale Closures

The `finishRest` callback is defined with `useCallback` and captures `current` and `total` from the render scope:

```tsx
const finishRest = useCallback(() => {
  if (current >= total) {  // ← stale values from closure
    showFinalScreen()
  } else {
    setCurrent(prev => prev + 1)
    ...
  }
}, [current, total, ...])
```

When `startCountdown` sets up its `setInterval`, it captures `finishRest` (which holds stale `current` and `total`). The interval fires after 30 seconds and calls `finishRest`, but `finishRest` reads the **old** `current` and `total` from its closure — not the latest state.

The `SVGTimer` component is purely visual — it reads from props but doesn't drive the countdown. The countdown is driven by `startCountdown` called from `startRestTimer`. This creates a disconnect where the visual display and the logic timer are driven by separate state sources.

### Fix Plan
1. **Use refs for `current` and `total`** so `finishRest` always reads the latest values, not stale closure values
2. **Consolidate the timer logic** — either the `SVGTimer` component drives the countdown itself, or the countdown updates its props directly so visual and logic stay in sync
3. **Consider `useReducer`** for the entire workout state to eliminate closure staleness

## Next Steps
1. Fix the stale closure bug in `finishRest` / timer logic
2. Ensure rest timer visually starts and animates correctly
3. Test both modes (Reps + Timed Exercise) end-to-end
4. Verify SVG timer animation and color transitions
5. Verify all button interactions (Start, Done, Skip, Back, Start Over)

## Commands
```bash
cd workout-timer-app
npm run dev
```
