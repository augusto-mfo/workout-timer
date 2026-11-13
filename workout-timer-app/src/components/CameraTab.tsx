import { useEffect, useRef, useState } from 'react'
import { fmtClock, useStreamVideo } from '../hooks/useCamera'
import type { CameraApi } from '../hooks/useCamera'

// ── Camera tab: full-size mirror, recording and review ──

export interface CameraOverlay {
  title: string
  big?: string | number
  sub?: string
  action?: { label: string; onClick: () => void }
}

const SPEEDS = [0.25, 0.5, 1]

export function CameraTab({
  cam,
  visible,
  overlay,
}: {
  cam: CameraApi
  visible: boolean
  overlay: CameraOverlay | null
}) {
  const { live, busy, error, mirror, recording, elapsed, clip, canRecord } = cam
  const videoRef = useStreamVideo(cam.stream)
  const clipVideoRef = useRef<HTMLVideoElement>(null)
  const [speed, setSpeed] = useState(1)

  // Some browsers pause a hidden <video>; resume it when the tab comes back
  useEffect(() => {
    if (visible && live) videoRef.current?.play().catch(() => {})
  }, [visible, live, videoRef])

  // New clip → back to normal speed
  useEffect(() => {
    setSpeed(1)
  }, [clip?.url])

  useEffect(() => {
    if (clipVideoRef.current) clipVideoRef.current.playbackRate = speed
  }, [speed, clip])

  return (
    <section
      className="cam-tab"
      id="panel-camera"
      role="tabpanel"
      aria-labelledby="tab-camera"
      style={visible ? undefined : { display: 'none' }}
    >
      <div className="glass cam-stage">
        <div className="cam-view">
          <video
            ref={videoRef}
            className="cam-video"
            style={mirror ? { transform: 'scaleX(-1)' } : undefined}
            autoPlay
            playsInline
            muted
          />

          {!live && (
            <div className="cam-placeholder">
              <p>The camera is off.</p>
              <p className="muted">Start it to watch yourself while you train. Video stays on this device.</p>
            </div>
          )}

          {recording && (
            <div className="cam-rec" role="status">
              <span className="cam-rec-dot" /> REC {fmtClock(elapsed)}
            </div>
          )}

          {live && overlay && (
            <div className="cam-overlay">
              <div className="cam-overlay-text">
                <div className="cam-overlay-title">{overlay.title}</div>
                {overlay.big !== undefined && <div className="cam-overlay-big">{overlay.big}</div>}
                {overlay.sub && <div className="cam-overlay-sub">{overlay.sub}</div>}
              </div>
              {overlay.action && (
                <button type="button" className="glass-btn glass-btn-exercise cam-overlay-btn" onClick={overlay.action.onClick}>
                  {overlay.action.label}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="cam-controls">
          {!live ? (
            <button type="button" className="glass-btn glass-btn-primary cam-big" onClick={cam.start} disabled={busy}>
              {busy ? 'Starting…' : '📷 Start camera'}
            </button>
          ) : (
            <>
              {canRecord ? (
                <button
                  type="button"
                  className={`glass-btn cam-big ${recording ? 'glass-btn-danger' : 'glass-btn-primary'}`}
                  onClick={recording ? cam.stopRecording : cam.startRecording}
                >
                  {recording ? '■ Stop recording' : '● Record'}
                </button>
              ) : (
                <p className="muted cam-note">Recording is not supported on this browser; the mirror still works.</p>
              )}
              <div className="cam-row">
                <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={cam.switchCamera} disabled={busy || recording}>
                  Switch camera
                </button>
                <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" aria-pressed={mirror} onClick={cam.toggleMirror}>
                  Mirror: {mirror ? 'on' : 'off'}
                </button>
                <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={cam.stop}>
                  Turn off
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="cam-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {clip && (
        <div className="glass cam-clip">
          <h3>Your recording</h3>
          <video
            ref={clipVideoRef}
            className="cam-clip-video"
            src={clip.url}
            controls
            playsInline
            onLoadedMetadata={e => {
              e.currentTarget.playbackRate = speed
            }}
          />
          <div className="cam-row" role="group" aria-label="Playback speed">
            {SPEEDS.map(s => (
              <button
                key={s}
                type="button"
                className="glass-btn glass-btn-ghost glass-btn-sm cam-speed"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
          </div>
          <div className="cam-row">
            <a className="glass-btn glass-btn-primary glass-btn-sm" href={clip.url} download={clip.name}>
              Download
            </a>
            <button type="button" className="glass-btn glass-btn-danger glass-btn-sm" onClick={cam.discardClip}>
              Discard
            </button>
          </div>
          <p className="hint cam-note">Not saved anywhere yet. Download it or it disappears when you close the page.</p>
        </div>
      )}
    </section>
  )
}
