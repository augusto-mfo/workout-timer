import { fmtClock, useStreamVideo } from '../hooks/useCamera'
import type { CameraApi } from '../hooks/useCamera'

// ── Compact camera shown inside the Workout view, next to the timer ──
// Uses the same camera as the Camera tab, so nothing restarts when you switch.

export function CameraDock({ cam, onReview }: { cam: CameraApi; onReview: () => void }) {
  const videoRef = useStreamVideo(cam.stream)

  if (!cam.live) {
    return (
      <div className="cam-dock-off">
        <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={cam.start} disabled={cam.busy}>
          {cam.busy ? 'Starting…' : '📷 Show camera'}
        </button>
        {cam.error && (
          <p className="cam-error" role="alert">
            {cam.error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="cam-dock">
      <div className="cam-view">
        <video
          ref={videoRef}
          className="cam-video"
          style={cam.mirror ? { transform: 'scaleX(-1)' } : undefined}
          autoPlay
          playsInline
          muted
        />
        {cam.recording && (
          <div className="cam-rec" role="status">
            <span className="cam-rec-dot" /> REC {fmtClock(cam.elapsed)}
          </div>
        )}
      </div>

      <div className="cam-dock-bar">
        {cam.canRecord && (
          <button
            type="button"
            className={`glass-btn glass-btn-sm ${cam.recording ? 'glass-btn-danger' : 'glass-btn-primary'}`}
            onClick={cam.recording ? cam.stopRecording : cam.startRecording}
          >
            {cam.recording ? '■ Stop' : '● Record'}
          </button>
        )}
        <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={cam.switchCamera} disabled={cam.busy || cam.recording}>
          Switch
        </button>
        <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" aria-pressed={cam.mirror} onClick={cam.toggleMirror}>
          Mirror
        </button>
        <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={cam.stop}>
          Off
        </button>
      </div>

      {cam.clip && !cam.recording && (
        <div className="cam-dock-bar">
          <span className="muted">Recording ready</span>
          <a className="glass-btn glass-btn-primary glass-btn-sm" href={cam.clip.url} download={cam.clip.name}>
            Download
          </a>
          <button type="button" className="glass-btn glass-btn-ghost glass-btn-sm" onClick={onReview}>
            Review
          </button>
        </div>
      )}

      {cam.error && (
        <p className="cam-error" role="alert">
          {cam.error}
        </p>
      )}
    </div>
  )
}
