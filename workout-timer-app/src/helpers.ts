// Workout Timer App Helpers

// ── Format Helpers ──
export const formatSeconds = (v: number) =>
  v < 60 ? `${v} s` : `${Math.floor(v / 60)} min${v % 60 ? ` ${v % 60} s` : ''}`

export const plural = (n: number | undefined, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
