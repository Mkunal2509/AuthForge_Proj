import React, { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000/api/v1/airsig';
const AUTO_SUBMIT_DELAY_MS = 2000;
const CIRCUMFERENCE = 226;

// Responsive 1€ Low-pass filter
class OneEuroFilter {
  constructor(minCutoff = 1.4, beta = 0.04, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0.0;
    this.tPrev = null;
  }

  alpha(cutoff, dt) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(x, timestampMs) {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.dxPrev = 0.0;
      this.tPrev = timestampMs;
      return x;
    }
    const dt = Math.max((timestampMs - this.tPrev) / 1000.0, 0.001);
    this.tPrev = timestampMs;

    const dx = (x - this.xPrev) / dt;
    this.dxPrev = this.dxPrev + this.alpha(this.dCutoff, dt) * (dx - this.dxPrev);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    const filteredX = this.xPrev + this.alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = filteredX;
    return filteredX;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0.0;
    this.tPrev = null;
  }
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [userId, setUserId] = useState('user_alice');
  const [enrollMode, setEnrollMode] = useState(false);
  const [currentPass, setCurrentPass] = useState(1);
  const [terminalText, setTerminalText] = useState('> Air-Signature Engine Ready.\n  Pinch Thumb + Index to sign. Hover freely. Withdraw hand to submit.');

  // Auto-Submit Countdown State
  const [showCountdown, setShowCountdown] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState('2.0');
  const [ringOffset, setRingOffset] = useState(0);

  // Stroke Buffers
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  const kinematicsRef = useRef([]);
  const enrolledPassesRef = useRef([]);

  const isPinchingRef = useRef(false);
  const isCapturedRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const countdownStartRef = useRef(null);

  const filterXRef = useRef(new OneEuroFilter());
  const filterYRef = useRef(new OneEuroFilter());

  const handleClear = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setShowCountdown(false);
    setRingOffset(0);

    strokesRef.current = [];
    currentStrokeRef.current = [];
    kinematicsRef.current = [];
    isCapturedRef.current = false;
    filterXRef.current.reset();
    filterYRef.current.reset();

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const startEnrollmentWizard = () => {
    handleClear();
    setEnrollMode(true);
    setCurrentPass(1);
    enrolledPassesRef.current = [];
    setTerminalText(`> ENROLLMENT STARTED for [${userId}]:\n  Pinch to write Pass 1 of 3. Withdraw hand from frame when finished.`);
  };

  const cancelEnrollment = () => {
    handleClear();
    setEnrollMode(false);
    setCurrentPass(1);
    enrolledPassesRef.current = [];
    setTerminalText('> Enrollment aborted.');
  };

  const submitFusedEnrollment = async (passes) => {
    setTerminalText(`> Synthesizing 3-pass master template via DBA for [${userId}]...`);
    try {
      const res = await fetch(`${API_BASE}/enroll-fused`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'default',
          user_id: userId,
          passes: passes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Enrollment failed');

      setTerminalText(`> [ENROLLMENT COMPLETE]\n  ${data.message}\n  Vault updated with unique topological profile.`);
      setEnrollMode(false);
      setCurrentPass(1);
      enrolledPassesRef.current = [];
      handleClear();
    } catch (err) {
      setTerminalText(`> Enrollment Error: ${err.message}`);
    }
  };

  const handleVerificationRequest = useCallback(async () => {
    const allStrokes = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
    const points = allStrokes.flat().map(p => [p[0], p[1]]);

    if (points.length < 15) {
      setTerminalText('> Signature too short. Pinch and sign a full gesture.');
      return;
    }

    setTerminalText(`> Verifying candidate against vault for [${userId}]...`);

    try {
      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'default',
          user_id: userId,
          points: points,
          kinematics: kinematicsRef.current
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Verification error');

      const flag = result.authenticated ? '[MATCH VERIFIED - ACCESS GRANTED]' : '[ACCESS DENIED - MISMATCH]';
      setTerminalText(
        `> ${flag}\n` +
        `  Target User: ${userId}\n` +
        `  Normalized DTW: ${result.dtw_distance} (Threshold: <= ${result.threshold})\n` +
        `  Confidence: ${result.confidence_score}\n` +
        `  Shape Divergence: ${result.shape_distance} | Kinematics: ${result.behavioral_distance}`
      );
    } catch (err) {
      setTerminalText(`> Verification Error: ${err.message}`);
    }
  }, [userId]);

  const handleAutoDispatch = useCallback(() => {
    const allStrokes = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
    const points = allStrokes.flat().map(p => [p[0], p[1]]);
    if (points.length < 15) return;

    if (enrollMode) {
      const passData = { points, kinematics: [...kinematicsRef.current] };
      const updated = [...enrolledPassesRef.current, passData];
      enrolledPassesRef.current = updated;

      if (updated.length < 3) {
        const next = updated.length + 1;
        setCurrentPass(next);
        handleClear();
        setTerminalText(`> Pass ${updated.length}/3 saved!\n  Now sign Pass ${next} of 3, then withdraw hand.`);
      } else {
        handleClear();
        submitFusedEnrollment(updated);
      }
    } else {
      handleVerificationRequest();
    }
  }, [enrollMode, handleVerificationRequest, handleClear]);

  // Non-Interruptive Countdown Handlers
  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current || isCapturedRef.current) return;
    const totalPoints = strokesRef.current.flat().length + currentStrokeRef.current.length;
    if (totalPoints < 15) return;

    setShowCountdown(true);
    countdownStartRef.current = performance.now();

    countdownTimerRef.current = setInterval(() => {
      const elapsed = performance.now() - countdownStartRef.current;
      const remaining = Math.max(0, AUTO_SUBMIT_DELAY_MS - elapsed);

      setSecondsLeft((remaining / 1000).toFixed(1));
      const fraction = remaining / AUTO_SUBMIT_DELAY_MS;
      setRingOffset(CIRCUMFERENCE * (1 - fraction));

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setShowCountdown(false);
        isCapturedRef.current = true;
        handleAutoDispatch();
      }
    }, 25);
  }, [handleAutoDispatch]);

  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      setShowCountdown(false);
      setRingOffset(0);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const hands = new window.Hands({
      locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.70,
      minTrackingConfidence: 0.70
    });

    hands.onResults(results => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      if (handDetected) {
        // NON-INTERRUPTIVE GUARD: Hand is in view, cancel any pending submission
        stopCountdown();

        const lm = results.multiHandLandmarks[0];
        const wrist = lm[0];
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const middleMcp = lm[9];

        const palmSpan = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 1.0;
        const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const pinchRatio = pinchDistance / palmSpan;

        // Tactile Pinch Clutch
        if (!isPinchingRef.current && pinchRatio < 0.24) {
          isPinchingRef.current = true;
        } else if (isPinchingRef.current && pinchRatio > 0.36) {
          isPinchingRef.current = false;
        }
        const activePinch = isPinchingRef.current;

        const now = performance.now();
        const rawX = indexTip.x * canvas.width;
        const rawY = indexTip.y * canvas.height;

        const smoothX = filterXRef.current.filter(rawX, now);
        const smoothY = filterYRef.current.filter(rawY, now);

        if (activePinch) {
          const lastPt = currentStrokeRef.current[currentStrokeRef.current.length - 1];
          if (!lastPt || Math.hypot(smoothX - lastPt[0], smoothY - lastPt[1]) >= 1.2) {
            if (currentStrokeRef.current.length === 0) isCapturedRef.current = false;
            currentStrokeRef.current.push([smoothX, smoothY, now]);
            kinematicsRef.current.push([smoothX, smoothY, now]);
          }

          // Inking Nib
          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00f2fe';
          ctx.fill();
        } else {
          // Hover Reticle (User is lifting pen to reposition or cross 't')
          if (currentStrokeRef.current.length > 1) {
            strokesRef.current.push([...currentStrokeRef.current]);
          }
          currentStrokeRef.current = [];

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 6, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        // Hand left the frame: pack in-progress stroke and trigger submission countdown
        isPinchingRef.current = false;
        filterXRef.current.reset();
        filterYRef.current.reset();

        if (currentStrokeRef.current.length > 1) {
          strokesRef.current.push([...currentStrokeRef.current]);
        }
        currentStrokeRef.current = [];

        const totalPts = strokesRef.current.flat().length;
        if (totalPts >= 15 && !isCapturedRef.current) {
          startCountdown();
        }
      }

      // Render Smooth Splines
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 4;

      const fullList = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
      for (const stroke of fullList) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0][0], stroke[0][1]);
        for (let i = 1; i < stroke.length - 1; i++) {
          const midX = (stroke[i][0] + stroke[i + 1][0]) / 2;
          const midY = (stroke[i][1] + stroke[i + 1][1]) / 2;
          ctx.quadraticCurveTo(stroke[i][0], stroke[i][1], midX, midY);
        }
        ctx.lineTo(stroke[stroke.length - 1][0], stroke[stroke.length - 1][1]);
        ctx.stroke();
      }

      ctx.restore();
    });

    const camera = new window.Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width: 640,
      height: 480
    });
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, [startCountdown, stopCountdown]);

  return (
    <div style={styles.container}>
      <h2 style={{ margin: '0 0 4px 0', color: '#38bdf8' }}>AuthForge Air-Signature Studio</h2>
      <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0' }}>
        Tactile Pinch Inking with Non-Interruptive Hand-Withdrawal Auto-Submit
      </p>

      <div style={styles.grid}>
        <div style={styles.viewportWrapper}>
          <video ref={videoRef} playsInline muted style={styles.videoCanvas} />
          <canvas ref={canvasRef} width={640} height={480} style={styles.videoCanvas} />

          <div style={styles.hudBadge}>
            {enrollMode ? `Enrollment: Pass ${currentPass} of 3` : 'Verification Active'}
          </div>

          {showCountdown && (
            <div style={styles.countdownModal}>
              <div style={styles.timerRing}>
                <svg style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }} viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="#00f2fe"
                    strokeWidth="6"
                    strokeDasharray={CIRCUMFERENCE}
                    style={{ strokeDashoffset: ringOffset, transition: 'stroke-dashoffset 25ms linear' }}
                  />
                </svg>
                <span style={styles.timerText}>{secondsLeft}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {enrollMode ? `Auto-Recording Pass ${currentPass}...` : "Auto-Verifying Signature..."}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Return hand to camera to keep signing
              </div>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.card}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>User Identifier:</label>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              disabled={enrollMode}
              style={styles.input}
              placeholder="e.g. user_alice"
            />

            {!enrollMode ? (
              <>
                <button style={{ ...styles.button, background: '#3b82f6', color: '#fff' }} onClick={startEnrollmentWizard}>
                  Start 3-Pass Enrollment
                </button>
                <button style={{ ...styles.button, background: '#10b981', color: '#fff' }} onClick={handleVerificationRequest}>
                  Verify Now (Manual)
                </button>
              </>
            ) : (
              <button style={{ ...styles.button, background: '#ef4444', color: '#fff' }} onClick={cancelEnrollment}>
                Abort Enrollment
              </button>
            )}

            <button style={{ ...styles.button, background: '#1e293b', color: '#94a3b8' }} onClick={handleClear}>
              Clear Canvas
            </button>
          </div>

          <div style={styles.card}>
            <div style={styles.terminal}>{terminalText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#070b14',
    color: '#f8fafc',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px'
  },
  grid: { display: 'grid', gridTemplateColumns: '640px 340px', gap: '20px' },
  viewportWrapper: {
    position: 'relative',
    width: '640px',
    height: '480px',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#000',
    border: '2px solid #1e293b'
  },
  videoCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '640px',
    height: '480px',
    transform: 'scaleX(-1)'
  },
  hudBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#38bdf8',
    zIndex: 5
  },
  countdownModal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 11, 20, 0.94)',
    border: '1px solid rgba(0, 242, 254, 0.4)',
    borderRadius: '16px',
    padding: '20px 28px',
    backdropFilter: 'blur(10px)',
    zIndex: 20
  },
  timerRing: {
    position: 'relative',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px'
  },
  timerText: { position: 'absolute', fontSize: '19px', fontWeight: 700, fontFamily: 'monospace' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '14px' },
  card: {
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  input: {
    background: '#070b14',
    border: '1px solid #334155',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none'
  },
  button: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: 'none',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer'
  },
  terminal: {
    background: '#060a14',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#38bdf8',
    minHeight: '130px',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.5'
  }
};