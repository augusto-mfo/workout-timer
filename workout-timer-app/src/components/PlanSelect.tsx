import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

// ── Rounded dropdown (replaces the native <select>, whose open list can't be styled) ──
// Keyboard: ↑ ↓ Home End to move, Enter/Space to choose, Esc to close.

export interface PlanOption {
  id: string
  label: string
}

export function PlanSelect({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  options: PlanOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const uid = useId()

  const selectedIndex = Math.max(0, options.findIndex(o => o.id === value))
  const current = options[selectedIndex]

  const openList = () => {
    if (disabled) return
    setHl(selectedIndex)
    setOpen(true)
  }
  const choose = (i: number) => {
    const o = options[i]
    if (o) onChange(o.id)
    setOpen(false)
  }

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  // Close when clicking or tapping outside
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Keep the highlighted option visible
  useEffect(() => {
    if (open) listRef.current?.children[hl]?.scrollIntoView({ block: 'nearest' })
  }, [open, hl])

  const last = options.length - 1
  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) openList()
        else setHl(i => Math.min(i + 1, last))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!open) openList()
        else setHl(i => Math.max(i - 1, 0))
        break
      case 'Home':
        if (open) { e.preventDefault(); setHl(0) }
        break
      case 'End':
        if (open) { e.preventDefault(); setHl(last) }
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) choose(hl)
        else openList()
        break
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false) }
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="dd" ref={wrapRef}>
      <button
        type="button"
        role="combobox"
        className="glass-btn dd-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-activedescendant={open ? `${uid}-opt-${hl}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onKeyUp={e => {
          if (e.key === ' ') e.preventDefault()
        }}
      >
        <span className="dd-label">{current?.label ?? ''}</span>
        <svg className={`dd-chevron${open ? ' open' : ''}`} width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="dd-list" role="listbox" id={`${uid}-list`} aria-label={ariaLabel} ref={listRef}>
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={o.id === value}
              className={`dd-opt${i === hl ? ' hl' : ''}${o.id === value ? ' selected' : ''}`}
              onMouseEnter={() => setHl(i)}
              onClick={() => choose(i)}
            >
              <span className="dd-label">{o.label}</span>
              {o.id === value && <span aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
