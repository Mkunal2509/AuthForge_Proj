import React, { useEffect, useRef, useState, useCallback } from 'react';

const AUTO_CAPTURE_MS = 1800;
const CIRCUMFERENCE = 226;

// 1€ Filter (Low-latency adaptive filter for human motion tracking)
class OneEuroFilter {
  constructor(minCutoff = 1.2, beta = 0.008, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = null;
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

    // Estimate derivative
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxPrev + this.alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    this.dxPrev = edx;

    // Dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const filteredX = this.xPrev + this.alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = filteredX;

    return filteredX;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = null;
    this.tPrev = null;
  }
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Direct DOM Refs (prevents React re-renders from throttling the 60 FPS canvas loop)
  const hudDotRef = useRef(null);
  const hudLabelRef = useRef(null);
  const pointCounterRef = useRef(null);

  const [userId, setUserId] = useState('kunal_01');
  const [terminalText, setTerminalText] = useState('> System active. Pinch Thumb + Index to sign.');
  const [enrollMode, setEnrollMode] = useState(false);
  const [currentPass, setCurrentPass] = useState(1);

  // Auto-Submit Overlay
  const [showCountdown, setShowCountdown] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState('1.8');
  const [ringOffset, setRingOffset] = useState(0);

  // Data Buffers
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  const kinematicsRef = useRef([]);
  const enrollmentPassesRef = useRef([]);

  // State Tracking
  const isPinchingRef = useRef(false);
  const isCapturedRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const countdownStartRef = useRef(null);

  // Kinematic Filters (X & Y independent 1€ filters)
  const filterXRef = useRef(new OneEuroFilter());
  const filterYRef = useRef(new OneEuroFilter());

  const handleClear = () => {
    stopCountdown();
    strokesRef.current = [];
    currentStrokeRef.current = [];
    kinematicsRef.current = [];
    isCapturedRef.current = false;
    filterXRef.current.reset();
    filterYRef.current.reset();

    if (pointCounterRef.current) pointCounterRef.current.innerText = 'Tracked Points: 0';
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startEnrollmentWizard = () => {
    handleClear();
    setEnrollMode(true);
    setCurrentPass(1);
    enrollmentPassesRef.current = [];
    setTerminalText('> 3-PASS ENROLLMENT STARTED:\n  Sign Pass 1 of 3 (Pinch Thumb + Index, then withdraw hand).');
  };

  const cancelEnrollment = () => {
    handleClear();
    setEnrollMode(false);
    setCurrentPass(1);
    enrollmentPassesRef.current = [];
    setTerminalText('> Enrollment cancelled. Returned to standard mode.');
  };

  const submitFusedEnrollment = async (passes) => {
    setTerminalText('> Synthesizing 3 passes via DTW Barycenter Averaging (DBA)...');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/airsig/enroll-fused', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, passes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Enrollment failed');

      setTerminalText(`> [ENROLLMENT COMPLETE]\n  ${data.message}\n  Master signature is active.`);
      setEnrollMode(false);
      setCurrentPass(1);
      enrollmentPassesRef.current = [];
    } catch (err) {
      setTerminalText(`> Enrollment Error: ${err.message}`);
    }
  };

  const handleVerificationRequest = useCallback(async () => {
    const allStrokes = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
    const points = allStrokes.flat();

    if (points.length < 12) {
      setTerminalText('> Signature too short. Pinch to sign a complete shape.');
      return;
    }

    setTerminalText(`> Verifying gesture against 3-pass master template...`);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/airsig/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          points: points,
          kinematics: kinematicsRef.current
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Verification error');

      const flag = result.authenticated ? '[MATCH VERIFIED]' : '[ACCESS DENIED - MISMATCH]';
      setTerminalText(`> ${flag}\n  Confidence: ${result.confidence_score}\n  Combined Cost: ${result.dtw_distance} (Threshold: < ${result.threshold})\n  Shape Cost: ${result.shape_distance} | Movement Cost: ${result.behavioral_distance}`);
    } catch (err) {
      setTerminalText(`> Verification Error: ${err.message}`);
    }
  }, [userId]);

  const handleAutoDispatch = useCallback(() => {
    const allStrokes = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
    const points = allStrokes.flat();
    if (points.length < 12) return;

    if (enrollMode) {
      const passData = { points, kinematics: [...kinematicsRef.current] };
      const updated = [...enrollmentPassesRef.current, passData];
      enrollmentPassesRef.current = updated;

      if (updated.length < 3) {
        const next = updated.length + 1;
        setCurrentPass(next);
        handleClear();
        setTerminalText(`> Pass ${updated.length} of 3 captured!\n  Now sign Pass ${next} of 3 (Pinch Thumb + Index).`);
      } else {
        handleClear();
        submitFusedEnrollment(updated);
      }
    } else {
      handleVerificationRequest();
    }
  }, [enrollMode, handleVerificationRequest]);

  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current || isCapturedRef.current) return;
    const totalPoints = strokesRef.current.flat().length + currentStrokeRef.current.length;
    if (totalPoints < 12) return;

    setShowCountdown(true);
    countdownStartRef.current = performance.now();

    countdownTimerRef.current = setInterval(() => {
      const elapsed = performance.now() - countdownStartRef.current;
      const remaining = Math.max(0, AUTO_CAPTURE_MS - elapsed);

      setSecondsRemaining((remaining / 1000).toFixed(1));
      const fraction = remaining / AUTO_CAPTURE_MS;
      setRingOffset(CIRCUMFERENCE * (1 - fraction));

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setShowCountdown(false);
        isCapturedRef.current = true;
        handleAutoDispatch();
      }
    }, 30);
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

    const handleFrameResults = (results) => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const detected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      if (detected) {
        stopCountdown();

        const lm = results.multiHandLandmarks[0];
        const wrist = lm[0];
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const middleMcp = lm[9];

        // 1. Normalized pinch metric (ratio to hand palm size)
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
        const handScale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y, middleMcp.z - wrist.z);
        const ratio = pinchDist / Math.max(0.01, handScale);

        // 2. Schmitt Trigger Hysteresis (prevents mid-stroke pen flickering)
        if (!isPinchingRef.current && ratio < 0.28) {
          isPinchingRef.current = true;
        } else if (isPinchingRef.current && ratio > 0.42) {
          isPinchingRef.current = false;
        }
        const activePinch = isPinchingRef.current;

        // 3. Coordinate filtering via 1€ Filter
        const now = performance.now();
        const rawX = (activePinch ? (thumbTip.x + indexTip.x) / 2 : indexTip.x) * canvas.width;
        const rawY = (activePinch ? (thumbTip.y + indexTip.y) / 2 : indexTip.y) * canvas.height;

        const smoothX = filterXRef.current.filter(rawX, now);
        const smoothY = filterYRef.current.filter(rawY, now);
        const handTilt = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);

        // 4. Update HUD elements directly without React re-render penalty
        if (activePinch) {
          if (currentStrokeRef.current.length === 0) {
            isCapturedRef.current = false;
          }
          currentStrokeRef.current.push([smoothX, smoothY]);
          kinematicsRef.current.push([smoothX, smoothY, now, handTilt]);

          if (hudDotRef.current) {
            hudDotRef.current.style.background = '#00f2fe';
            hudDotRef.current.style.boxShadow = '0 0 10px #00f2fe';
          }
          if (hudLabelRef.current) hudLabelRef.current.innerText = '✍️ Drawing (Pinch Engaged)';

          // Active drawing cursor
          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 7, 0, 2 * Math.PI);
          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 15;
          ctx.fill();
        } else {
          if (currentStrokeRef.current.length > 2) {
            strokesRef.current.push([...currentStrokeRef.current]);
          }
          currentStrokeRef.current = [];

          if (hudDotRef.current) {
            hudDotRef.current.style.background = '#f59e0b';
            hudDotRef.current.style.boxShadow = 'none';
          }
          if (hudLabelRef.current) hudLabelRef.current.innerText = '🖐️ Hovering (Pinch to Draw)';

          // Hover cursor
          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 6, 0, 2 * Math.PI);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        const totalPts = strokesRef.current.flat().length + currentStrokeRef.current.length;
        if (pointCounterRef.current) pointCounterRef.current.innerText = `Tracked Points: ${totalPts}`;
      } else {
        // Hand removed from view
        isPinchingRef.current = false;
        filterXRef.current.reset();
        filterYRef.current.reset();

        if (currentStrokeRef.current.length > 2) {
          strokesRef.current.push([...currentStrokeRef.current]);
        }
        currentStrokeRef.current = [];

        if (hudDotRef.current) hudDotRef.current.style.background = '#64748b';
        if (hudLabelRef.current) hudLabelRef.current.innerText = 'Hand Out of Frame';

        const totalPts = strokesRef.current.flat().length;
        if (totalPts >= 12 && !isCapturedRef.current) {
          startCountdown();
        }
      }

      // 5. Draw smooth spline curves
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#00f2fe';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 12;

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
    };

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0, // Complexity 0 runs at 60 FPS on edge CPUs without GPU frame-drops
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65
    });

    hands.onResults(handleFrameResults);

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
      <div style={styles.header}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>AuthForge Air-Signature Studio</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          One-Euro Filtered Pinch Gestures with 3-Pass DBA Fusion
        </p>
      </div>

      <div style={styles.grid}>
        <div style={styles.viewportWrapper}>
          <video ref={videoRef} playsInline muted style={styles.videoCanvas} />
          <canvas ref={canvasRef} width={640} height={480} style={styles.videoCanvas} />

          <div style={styles.hudOverlay}>
            <div style={styles.hudChip}>
              <div ref={hudDotRef} style={styles.hudDot} />
              <span ref={hudLabelRef}>Awaiting Hand...</span>
            </div>
            {enrollMode ? (
              <div style={{ ...styles.hudChip, background: '#1e3a8a', border: '1px solid #3b82f6' }}>
                <span>Enrollment: Pass {currentPass} / 3</span>
              </div>
            ) : (
              <div style={styles.hudChip}>
                <span ref={pointCounterRef}>Tracked Points: 0</span>
              </div>
            )}
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
                    style={{ strokeDashoffset: ringOffset, transition: 'stroke-dashoffset 50ms linear' }}
                  />
                </svg>
                <span style={styles.timerText}>{secondsRemaining}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {enrollMode ? `Capturing Pass ${currentPass} of 3...` : "Verifying Signature..."}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Return hand to cancel</div>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.card}>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
              <strong style={{ color: '#fff' }}>Fluid Gestures:</strong><br />
              • <strong>👌 Pinch Thumb + Index:</strong> Draws cursive ink.<br />
              • <strong>🖐️ Release Pinch:</strong> Hovers / repositions cursor.<br />
              • <strong>Withdraw Hand:</strong> Auto-submits after 1.8s.
            </p>
          </div>

          <div style={styles.card}>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>User Identifier</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={enrollMode}
              style={styles.input}
            />

            {!enrollMode ? (
              <>
                <button
                  style={{ ...styles.button, background: '#00f2fe', color: '#050811' }}
                  onClick={startEnrollmentWizard}
                >
                  Start 3-Pass Enrollment
                </button>
                <button
                  style={{ ...styles.button, background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  onClick={handleVerificationRequest}
                >
                  Verify Signature Now
                </button>
              </>
            ) : (
              <button
                style={{ ...styles.button, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                onClick={cancelEnrollment}
              >
                Abort Enrollment
              </button>
            )}

            <button
              style={{ ...styles.button, background: '#1e293b', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
              onClick={handleClear}
            >
              Clear Buffer
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
    padding: '24px 16px'
  },
  header: { textAlign: 'center', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: '640px 340px', gap: '24px' },
  viewportWrapper: {
    position: 'relative',
    width: '640px',
    height: '480px',
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: '#000',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)'
  },
  videoCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '640px',
    height: '480px',
    transform: 'scaleX(-1)'
  },
  hudOverlay: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    zIndex: 10
  },
  hudChip: {
    background: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  hudDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#f59e0b'
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
    background: 'rgba(7, 11, 20, 0.92)',
    border: '1px solid rgba(0, 242, 254, 0.3)',
    boxShadow: '0 0 30px rgba(0, 242, 254, 0.2)',
    borderRadius: '18px',
    padding: '24px 30px',
    backdropFilter: 'blur(12px)',
    zIndex: 20
  },
  timerRing: {
    position: 'relative',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px'
  },
  timerText: {
    position: 'absolute',
    fontSize: '20px',
    fontWeight: 700,
    fontFamily: 'monospace'
  },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  input: {
    background: '#0c1222',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none'
  },
  button: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer'
  },
  terminal: {
    background: '#060a14',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#38bdf8',
    minHeight: '110px',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.5'
  }
};