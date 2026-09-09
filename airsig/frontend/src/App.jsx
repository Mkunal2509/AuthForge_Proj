import React, { useEffect, useRef, useState, useCallback } from 'react';

const AUTO_CAPTURE_MS = 1700;
const CIRCUMFERENCE = 226;
const MIN_SAMPLE_DISTANCE_PX = 3.8; // Spatial decimation: drops redundant stationary jitter

class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
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

  // Direct DOM Nodes (0-latency UI updates)
  const hudDotRef = useRef(null);
  const hudLabelRef = useRef(null);
  const pointCounterRef = useRef(null);

  const [userId, setUserId] = useState('kunal_01');
  const [terminalText, setTerminalText] = useState('> Optimized pipeline online. Pinch Thumb + Index to sign.');
  const [enrollMode, setEnrollMode] = useState(false);
  const [currentPass, setCurrentPass] = useState(1);

  // Auto-Submit Overlay
  const [showCountdown, setShowCountdown] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState('1.7');
  const [ringOffset, setRingOffset] = useState(0);

  // Trajectory & Kinematic Buffers
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  const kinematicsRef = useRef([]);
  const enrollmentPassesRef = useRef([]);

  const isPinchingRef = useRef(false);
  const isCapturedRef = useRef(false);
  const countdownTimerRef = useRef(null);
  const countdownStartRef = useRef(null);

  const filterXRef = useRef(new OneEuroFilter());
  const filterYRef = useRef(new OneEuroFilter());
  const filterZRef = useRef(new OneEuroFilter());

  const handleClear = () => {
    stopCountdown();
    strokesRef.current = [];
    currentStrokeRef.current = [];
    kinematicsRef.current = [];
    isCapturedRef.current = false;
    filterXRef.current.reset();
    filterYRef.current.reset();
    filterZRef.current.reset();

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
    setTerminalText('> 3-PASS ENROLLMENT STARTED:\n  Sign Pass 1 of 3 (Pinch to sign, then remove hand).');
  };

  const cancelEnrollment = () => {
    handleClear();
    setEnrollMode(false);
    setCurrentPass(1);
    enrollmentPassesRef.current = [];
    setTerminalText('> Enrollment aborted. Returned to standard mode.');
  };

  const submitFusedEnrollment = async (passes) => {
    setTerminalText('> Processing 3-Pass PCA-DBA Template Synthesis...');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/airsig/enroll-fused', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, passes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Enrollment failed');

      setTerminalText(`> [ENROLLMENT SUCCESSFUL]\n  ${data.message}\n  PCA rotational anchor and encrypted vault updated.`);
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

    if (points.length < 10) {
      setTerminalText('> Stroke too short. Pinch and draw a complete gesture.');
      return;
    }

    setTerminalText(`> Running 3D PCA-DTW verification & kinematic analysis...`);

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

      const flag = result.authenticated ? '[MATCH VERIFIED - ACCESS GRANTED]' : '[ACCESS DENIED - MISMATCH]';
      setTerminalText(`> ${flag}\n  Confidence: ${result.confidence_score}\n  Fused Cost: ${result.dtw_distance} (Threshold: < ${result.threshold})\n  Rotational-Invariance Cost: ${result.shape_distance}\n  Neuromuscular Velocity Distance: ${result.behavioral_distance}`);
    } catch (err) {
      setTerminalText(`> Verification Error: ${err.message}`);
    }
  }, [userId]);

  const handleAutoDispatch = useCallback(() => {
    const allStrokes = [...strokesRef.current, ...(currentStrokeRef.current.length > 0 ? [currentStrokeRef.current] : [])];
    const points = allStrokes.flat();
    if (points.length < 10) return;

    if (enrollMode) {
      const passData = { points, kinematics: [...kinematicsRef.current] };
      const updated = [...enrollmentPassesRef.current, passData];
      enrollmentPassesRef.current = updated;

      if (updated.length < 3) {
        const next = updated.length + 1;
        setCurrentPass(next);
        handleClear();
        setTerminalText(`> Pass ${updated.length}/3 stored.\n  Sign Pass ${next} of 3 (Pinch Thumb + Index).`);
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
    if (totalPoints < 10) return;

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
    const ctx = canvas.getContext('2d', { alpha: false }); // Disable canvas alpha blending for faster GPU rasterization

    let isRunning = true;

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0, // Lite model eliminates inference lag completely
      minDetectionConfidence: 0.60,
      minTrackingConfidence: 0.60
    });

    hands.onResults((results) => {
      if (!isRunning) return;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const detected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      if (detected) {
        stopCountdown();

        const lm = results.multiHandLandmarks[0];
        const wrist = lm[0];
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const middleMcp = lm[9];

        // Palm scale normalization
        const palmSize = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y, middleMcp.z - wrist.z) || 1.0;
        const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
        const pinchRatio = pinchDistance / palmSize;

        // Dynamic Schmitt-Trigger Hysteresis
        if (!isPinchingRef.current && pinchRatio < 0.27) {
          isPinchingRef.current = true;
        } else if (isPinchingRef.current && pinchRatio > 0.40) {
          isPinchingRef.current = false;
        }
        const activePinch = isPinchingRef.current;

        const now = performance.now();
        const rawX = (activePinch ? (thumbTip.x + indexTip.x) / 2 : indexTip.x) * canvas.width;
        const rawY = (activePinch ? (thumbTip.y + indexTip.y) / 2 : indexTip.y) * canvas.height;
        const rawZ = ((thumbTip.z + indexTip.z) / 2) / palmSize;

        const smoothX = filterXRef.current.filter(rawX, now);
        const smoothY = filterYRef.current.filter(rawY, now);
        const smoothZ = filterZRef.current.filter(rawZ, now);
        const handTilt = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);

        if (activePinch) {
          // Spatial Decimation: Only add point if hand has moved past Euclidean pixel threshold
          const lastPt = currentStrokeRef.current[currentStrokeRef.current.length - 1];
          const hasMovedEnough = !lastPt || Math.hypot(smoothX - lastPt[0], smoothY - lastPt[1]) >= MIN_SAMPLE_DISTANCE_PX;

          if (hasMovedEnough) {
            if (currentStrokeRef.current.length === 0) isCapturedRef.current = false;
            currentStrokeRef.current.push([smoothX, smoothY]);
            kinematicsRef.current.push([smoothX, smoothY, smoothZ, now, handTilt]);
          }

          if (hudDotRef.current) {
            hudDotRef.current.style.background = '#00f2fe';
            hudDotRef.current.style.boxShadow = '0 0 10px #00f2fe';
          }
          if (hudLabelRef.current) hudLabelRef.current.innerText = '✍️ Drawing (Pinch Engaged)';

          // Pointer Visualizer
          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#00f2fe';
          ctx.fill();
        } else {
          if (currentStrokeRef.current.length > 1) {
            strokesRef.current.push([...currentStrokeRef.current]);
          }
          currentStrokeRef.current = [];

          if (hudDotRef.current) {
            hudDotRef.current.style.background = '#f59e0b';
            hudDotRef.current.style.boxShadow = 'none';
          }
          if (hudLabelRef.current) hudLabelRef.current.innerText = '🖐️ Hovering (Pinch to Draw)';

          ctx.beginPath();
          ctx.arc(smoothX, smoothY, 5, 0, 2 * Math.PI);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const totalPts = strokesRef.current.flat().length + currentStrokeRef.current.length;
        if (pointCounterRef.current) pointCounterRef.current.innerText = `Points: ${totalPts}`;
      } else {
        isPinchingRef.current = false;
        filterXRef.current.reset();
        filterYRef.current.reset();
        filterZRef.current.reset();

        if (currentStrokeRef.current.length > 1) {
          strokesRef.current.push([...currentStrokeRef.current]);
        }
        currentStrokeRef.current = [];

        if (hudDotRef.current) hudDotRef.current.style.background = '#64748b';
        if (hudLabelRef.current) hudLabelRef.current.innerText = 'Hand Out of Frame';

        const totalPts = strokesRef.current.flat().length;
        if (totalPts >= 10 && !isCapturedRef.current) {
          startCountdown();
        }
      }

      // Spline Stroke Renderer
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#00f2fe';

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
    });

    // Zero-lag video frame processing loop using requestVideoFrameCallback
    let videoCallbackId;
    const processFrame = async () => {
      if (!isRunning) return;
      if (video.readyState >= 2) {
        await hands.send({ image: video });
      }
      if ('requestVideoFrameCallback' in video) {
        videoCallbackId = video.requestVideoFrameCallback(processFrame);
      } else {
        videoCallbackId = requestAnimationFrame(processFrame);
      }
    };

    navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 60 } }
    }).then((stream) => {
      video.srcObject = stream;
      video.play();
      if ('requestVideoFrameCallback' in video) {
        videoCallbackId = video.requestVideoFrameCallback(processFrame);
      } else {
        videoCallbackId = requestAnimationFrame(processFrame);
      }
    }).catch(err => setTerminalText(`> Camera Hardware Error: ${err.message}`));

    return () => {
      isRunning = false;
      if ('requestVideoFrameCallback' in video && videoCallbackId) {
        video.cancelVideoFrameCallback(videoCallbackId);
      } else {
        cancelAnimationFrame(videoCallbackId);
      }
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      hands.close();
    };
  }, [startCountdown, stopCountdown]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>AuthForge High-Precision Air-Signature</h1>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '2px' }}>
          Zero-Lag MediaPipe Lite Engine with Rotational PCA Invariance
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
                <span ref={pointCounterRef}>Points: 0</span>
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
                    style={{ strokeDashoffset: ringOffset, transition: 'stroke-dashoffset 25ms linear' }}
                  />
                </svg>
                <span style={styles.timerText}>{secondsRemaining}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {enrollMode ? `Auto-Capturing Pass ${currentPass}...` : "Auto-Verifying..."}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Return hand to cancel</div>
            </div>
          )}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.card}>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
              <strong style={{ color: '#fff' }}>Gestures:</strong><br />
              • <strong>👌 Pinch Thumb + Index:</strong> Inks cursive trajectory.<br />
              • <strong>🖐️ Release Pinch:</strong> Hovers without drawing.<br />
              • <strong>Drop Hand Out of Frame:</strong> Auto-submits after 1.7s.
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
                <button style={{ ...styles.button, background: '#00f2fe', color: '#050811' }} onClick={startEnrollmentWizard}>
                  Start 3-Pass Enrollment
                </button>
                <button style={{ ...styles.button, background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={handleVerificationRequest}>
                  Verify Signature Now
                </button>
              </>
            ) : (
              <button style={{ ...styles.button, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }} onClick={cancelEnrollment}>
                Abort Enrollment
              </button>
            )}

            <button style={{ ...styles.button, background: '#1e293b', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }} onClick={handleClear}>
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
    padding: '16px'
  },
  header: { textAlign: 'center', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: '640px 340px', gap: '20px' },
  viewportWrapper: {
    position: 'relative',
    width: '640px',
    height: '480px',
    borderRadius: '14px',
    overflow: 'hidden',
    backgroundColor: '#000',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)'
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
    top: 12,
    left: 12,
    right: 12,
    display: 'flex',
    justifyContent: 'space-between',
    pointerEvents: 'none',
    zIndex: 10
  },
  hudChip: {
    background: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    padding: '5px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  hudDot: { width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' },
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
    border: '1px solid rgba(0, 242, 254, 0.3)',
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
    background: 'rgba(15, 23, 42, 0.8)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  input: {
    background: '#0c1222',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: '9px 12px',
    borderRadius: '7px',
    fontSize: '13px',
    outline: 'none'
  },
  button: {
    padding: '11px 14px',
    borderRadius: '7px',
    border: 'none',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer'
  },
  terminal: {
    background: '#060a14',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '7px',
    padding: '11px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#38bdf8',
    minHeight: '110px',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.45'
  }
};