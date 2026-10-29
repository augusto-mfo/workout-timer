import { useEffect, useId, useRef, useState } from 'react'
import type { DialogConfig } from '../types'

const CLOSE_MS = 220

interface Props {
  dialog: DialogConfig | null
  onClose: () => void
}

// A confirmation / prompt / alert sheet that slides down from the top of the screen.
// Replaces window.confirm, window.prompt and window.alert.
export function TopModal({ dialog, onClose }: Props) {
  const [current, setCurrent] = useState<DialogConfig | null>(null)
  const [closing, setClosing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const sheetRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uid = useId()

  // A new dialog was requested
  useEffect(() => {
    if (!dialog) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (!current) previousFocus.current = document.activeElement as HTMLElement | null
    setCurrent(dialog)
    setClosing(false)
    setValue(dialog.input?.defaultValue ?? '')
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog])

  // Move focus into the sheet when it opens
  useEffect(() => {
    if (!current) return
    const el = current.input ? inputRef.current : current.danger ? cancelRef.current ?? confirmRef.current : confirmRef.current
    el?.focus()
    if (current.input) inputRef.current?.select()
  }, [current])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  if (!current) return null

  const isAlert = current.cancelLabel === null

  const finish = (action: () => void) => {
    if (closing) return
    setClosing(true)
    closeTimer.current = setTimeout(() => {
      setCurrent(null)
      onClose()
      previousFocus.current?.focus?.()
      action()
    }, CLOSE_MS)
  }

  const confirm = () => {
    if (current.input?.required && !value.trim()) {
      setError('This field cannot be empty.')
      inputRef.current?.focus()
      return
    }
    finish(() => current.onConfirm?.(value.trim()))
  }

  const cancel = () => finish(() => (isAlert ? current.onConfirm?.('') : current.onCancel?.()))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault()
      confirm()
    } else if (e.key === 'Tab') {
      // keep focus inside the sheet
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)')
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className={`modal-root${closing ? ' closing' : ''}`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) cancel()
      }}
    >
      <div
        ref={sheetRef}
        className="modal-sheet glass"
        role={isAlert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={current.message ? `${uid}-msg` : undefined}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${uid}-title`} className="modal-title">{current.title}</h2>
        {current.message && <p id={`${uid}-msg`} className="modal-message">{current.message}</p>}

        {current.input && (
          <div className="field modal-field">
            <label htmlFor={`${uid}-input`} className="section-label">{current.input.label}</label>
            <input
              ref={inputRef}
              id={`${uid}-input`}
              type="text"
              className="glass-input modal-input"
              autoComplete="off"
              maxLength={current.input.maxLength ?? 60}
              placeholder={current.input.placeholder}
              value={value}
              aria-invalid={error ? true : undefined}
              onChange={e => {
                setValue(e.target.value)
                if (error) setError('')
              }}
            />
            {error && <div className="modal-error" role="alert">{error}</div>}
          </div>
        )}

        <div className="modal-actions">
          {!isAlert && (
            <button ref={cancelRef} className="glass-btn glass-btn-ghost" onClick={cancel}>
              {current.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            ref={confirmRef}
            className={`glass-btn ${current.danger ? 'glass-btn-danger' : 'glass-btn-primary'}`}
            onClick={confirm}
          >
            {current.confirmLabel ?? (isAlert ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
