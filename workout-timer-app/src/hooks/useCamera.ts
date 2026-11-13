import { useEffect, useRef, useState } from 'react'

// Shared camera state: one camera stream used by both the Camera tab (full view)
// and the dock inside the Workout view. Everything stays on the device.

type Facing = 'user' | 'environment'

const MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']

const pickMime = () =>
  typeof MediaRecorder === 'undefined' ? undefined : MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t))

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const fileStamp = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No suitable camera was found on this device.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is busy or unavailable. Close other apps that may be using it.'
  return 'Could not start the camera.'
}

export interface Clip {
  url: string
  ext: string
  name: string
}

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [mirror, setMirror] = useState(true)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [clip, setClip] = useState<Clip | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | undefined>(undefined)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const clipUrlRef = useRef<string | null>(null)

  const live = stream !== null
  const canRecord = typeof MediaRecorder !== 'undefined'

  // ── Screen wake lock: keep the phone awake while the camera is on ──
  const requestWake = async () => {
    try {
      if ('wakeLock' in navigator) wakeRef.current = await navigator.wakeLock.request('screen')
    } catch {
      /* not supported or refused – ignore */
    }
  }
  const releaseWake = () => {
    wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
  }
  // The browser drops the lock when the page is hidden; take it again on return
  useEffect(() => {
    if (!live) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') requestWake()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [live])

  // ── Cleanup when the app closes ──
  useEffect(() => {
    return () => {
      window.clearInterval(tickRef.current)
      const rec = recorderRef.current
      if (rec) {
        rec.onstop = null
        if (rec.state !== 'inactive') rec.stop()
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
      wakeRef.current?.release().catch(() => {})
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
    }
  }, [])

  // ── Camera on / off / switch ──
  const startStream = async (face: Facing) => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera. The camera needs a secure page (HTTPS or localhost).')
      return
    }
    setBusy(true)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = s
      // If the camera disappears (unplugged, permission revoked), turn off cleanly
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === s) stop()
      })
      setStream(s)
      setFacing(face)
      setMirror(face === 'user')
      requestWake()
    } catch (e) {
      setError(cameraErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop() // keeps what was recorded so far
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    releaseWake()
    setStream(null)
  }

  const start = () => startStream(facing)
  const switchCamera = () => startStream(facing === 'user' ? 'environment' : 'user')
  const toggleMirror = () => setMirror(m => !m)

  // ── Recording ──
  const discardClip = () => {
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current)
    clipUrlRef.current = null
    setClip(null)
  }

  const startRecording = () => {
    const s = streamRef.current
    if (!s || !canRecord) return
    discardClip()
    const mime = pickMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
    } catch {
      setError('Recording is not supported on this browser.')
      return
    }
    chunksRef.current = []
    rec.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      window.clearInterval(tickRef.current)
      setRecording(false)
      const type = rec.mimeType || mime || 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      if (blob.size === 0) return
      const url = URL.createObjectURL(blob)
      clipUrlRef.current = url
      const ext = type.includes('mp4') ? 'mp4' : 'webm'
      setClip({ url, ext, name: `workout-${fileStamp()}.${ext}` })
    }
    rec.start(1000)
    recorderRef.current = rec
    setElapsed(0)
    setRecording(true)
    tickRef.current = window.setInterval(() => setElapsed(t => t + 1), 1000)
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  return {
    stream, live, busy, error, facing, mirror, recording, elapsed, clip, canRecord,
    start, stop, switchCamera, toggleMirror, startRecording, stopRecording, discardClip,
  }
}

export type CameraApi = ReturnType<typeof useCamera>

/** Ref for a <video> that shows the shared stream. Each view gets its own element. */
export function useStreamVideo(stream: MediaStream | null) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.srcObject = stream
    if (stream) v.play().catch(() => {})
  }, [stream])
  return ref
}
