# Session: Stale Closure Bug Fix

## Status
✅ Bug fixed, TypeScript compiles, production build passes.

## What Was Fixed

### The Bug: Stale Closures in `finishRest`

When `startRestTimer` calls `startCountdown`, which sets up a `setInterval`, the interval captures `finishRest` in its closure. `finishRest` was defined with `useCallback` depending on `[current, total, mode]` — but these values are captured at the time `useCallback` runs, not when the interval fires.

**Symptom:** Clicking Done on the last rep caused the workout to end immediately, skipping the rest timer entirely.

### Fix: Ref-Based State Access

Added ref copies of the state values that interval callbacks read:

```tsx
const currentRef = useRef(current)
const totalRef = useRef(total)
const modeRef = useRef(mode)
useEffect(() => { currentRef.current = current }, [current])
useEffect(() => { totalRef.current = total }, [total])
useEffect(() => { modeRef.current = mode }, [mode])
```

Updated `finishRest` to use refs instead of closure values:

```tsx
const finishRest = useCallback(() => {
  if (currentRef.current >= totalRef.current) {  // ← refs, not state
    showFinalScreen()
  } else {
    setCurrent(prev => prev + 1)
    if (modeRef.current === 'reps') {
      showRepScreen()
    } else {
      setExerciseRunning(false)
      showExerciseScreen()
    }
  }
}, [showRepScreen, showExerciseScreen])  // ← no longer depends on current/total/mode
```

### Files Modified
| File | Change |
|------|--------|
| `src/App.tsx` | Added `currentRef`, `totalRef`, `modeRef` + sync effects; updated `finishRest` to use refs |

### Verification
- `npx tsc --noEmit` — ✅ No errors
- `npx vite build` — ✅ 229KB JS, 4KB CSS

## Next Steps
1. Test both Reps mode and Timed Exercise mode end-to-end in browser
2. Verify rest timer displays and animates correctly
3. Verify SVG timer color transitions (green → yellow → red)
4. Verify all button interactions (Start, Done, Skip, Back, Start Over)
