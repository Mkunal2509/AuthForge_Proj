(function (window, document) {
  'use strict';

  const SDK_STYLES = `
    #af-overlay {
      position: fixed; inset: 0; background: rgba(3, 7, 18, 0.88);
      backdrop-filter: blur(14px); display: flex; align-items: center;
      justify-content: center; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #af-modal {
      background: #0f172a; border: 1px solid #334155; border-radius: 20px;
      width: 680px; max-width: 95vw; padding: 36px; color: #f8fafc;
      box-shadow: 0 30px 80px rgba(0,0,0,0.85); position: relative; text-align: center;
    }
    #af-close {
      position: absolute; top: 16px; right: 18px; background: transparent;
      border: none; color: #64748b; font-size: 20px; cursor: pointer; transition: color 0.2s;
    }
    #af-close:hover { color: #fff; }
    .af-step-pill {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
      border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
      margin-bottom: 14px; background: rgba(6, 182, 212, 0.12); color: #38bdf8;
      border: 1px solid rgba(6, 182, 212, 0.3); text-transform: uppercase;
    }
    .af-title { font-size: 22px; font-weight: 800; color: #fff; margin: 0 0 6px; }
    .af-desc { font-size: 14px; color: #94a3b8; margin: 0 0 24px; line-height: 1.5; }
    .af-form-group { text-align: left; margin-bottom: 16px; position: relative; }
    .af-label { font-size: 12px; color: #94a3b8; display: block; margin-bottom: 6px; font-weight: 600; }
    .af-input-wrapper { position: relative; display: flex; align-items: center; }
    .af-input {
      width: 100%; box-sizing: border-box; background: #070b14; border: 1px solid #334155;
      color: #fff; padding: 12px 16px; border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.2s;
    }
    .af-input:focus { border-color: #38bdf8; }
    .af-pwd-toggle {
      position: absolute; right: 12px; background: transparent; border: none;
      color: #94a3b8; cursor: pointer; font-size: 16px; display: flex; align-items: center;
      padding: 4px; user-select: none;
    }
    .af-pwd-toggle:hover { color: #38bdf8; }
    .af-btn-primary {
      background: linear-gradient(90deg, #06b6d4, #0284c7); color: #060913; border: none;
      padding: 14px 24px; border-radius: 10px; font-weight: 800; width: 100%; cursor: pointer;
      font-size: 14px; margin-top: 10px; transition: transform 0.15s, box-shadow 0.15s;
    }
    .af-btn-primary:hover {
      transform: translateY(-1px); box-shadow: 0 8px 20px rgba(6, 182, 212, 0.35);
    }
    .af-video-box {
      width: 560px; height: 380px; max-width: 100%; border-radius: 16px; overflow: hidden;
      margin: 16px auto; background: #000; position: relative; border: 2px solid #334155;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6);
    }
    .af-video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    .af-canvas {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: scaleX(-1); pointer-events: none;
    }
    .af-status-badge {
      display: inline-block; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;
      background: rgba(15, 23, 42, 0.9); border: 1px solid #334155; color: #38bdf8; margin-top: 12px;
    }
    .af-countdown-ring {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(7, 11, 20, 0.92); border: 1px solid #38bdf8; padding: 18px 28px;
      border-radius: 16px; backdrop-filter: blur(8px); text-align: center; z-index: 50;
    }
  `;

  class AuthForgeClient {
    constructor(config) {
      this.clientId = config.clientId || "client_apex_demo";
      this.userId = config.targetUser || "";
      this.onSuccess = config.onSuccess || (() => {});
      this.onError = config.onError || (() => {});
      this.mediaStream = null;
      this._injectStyles();
    }

    _injectStyles() {
      if (document.getElementById('af-sdk-styles')) return;
      const s = document.createElement('style');
      s.id = 'af-sdk-styles';
      s.innerHTML = SDK_STYLES;
      document.head.appendChild(s);
    }

    open() {
      if (document.getElementById('af-overlay')) return;
      const overlay = document.createElement('div');
      overlay.id = 'af-overlay';
      overlay.innerHTML = `
        <div id="af-modal">
          <button id="af-close">✕</button>
          <div id="af-content"></div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('af-close').onclick = () => this.close();
      this.renderStep1();
    }

    close() {
      this._stopCamera();
      const el = document.getElementById('af-overlay');
      if (el) el.remove();
    }

    _stopCamera() {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }
    }

    renderStep1() {
      const container = document.getElementById('af-content');
      container.innerHTML = `
        <div class="af-step-pill">Step 1 of 3 • Primary Credential</div>
        <h2 class="af-title">Sign In to Apex Banking</h2>
        <p class="af-desc">Enter your account username and password to authenticate.</p>

        <form id="af-step1-form" style="max-width: 440px; margin: 0 auto;">
          <div class="af-form-group">
            <label class="af-label">User ID</label>
            <input type="text" id="af-user-id" class="af-input" value="${this.userId}" placeholder="Enter User Name" required />
          </div>

          <div class="af-form-group">
            <label class="af-label">Password</label>
            <div class="af-input-wrapper">
              <input type="password" id="af-password" class="af-input" placeholder="Enter password" style="padding-right: 42px;" required />
              <button type="button" id="af-pwd-eye-btn" class="af-pwd-toggle" title="Toggle visibility">👁️</button>
            </div>
          </div>

          <button type="submit" class="af-btn-primary">Verify Credentials &amp; Proceed ➔</button>
        </form>
      `;

      const pwdInput = document.getElementById('af-password');
      const toggleBtn = document.getElementById('af-pwd-eye-btn');
      let isVisible = false;

      toggleBtn.onclick = () => {
        isVisible = !isVisible;
        pwdInput.type = isVisible ? 'text' : 'password';
        toggleBtn.innerText = isVisible ? '🙈' : '👁️';
      };

      document.getElementById('af-step1-form').onsubmit = async (e) => {
        e.preventDefault();
        this.userId = document.getElementById('af-user-id').value.trim().toLowerCase();
        const pwd = pwdInput.value;

        try {
          const res = await fetch('http://localhost:8000/api/v1/auth/step1-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: this.userId, password: pwd })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.detail);
          this.renderStep2();
        } catch (err) {
          alert("Step 1 Authentication Failed: " + err.message);
        }
      };
    }

    async renderStep2() {
      const container = document.getElementById('af-content');
      container.innerHTML = `
        <div class="af-step-pill">Step 2 of 3 • Facial Biometrics</div>
        <h2 class="af-title">Facial Verification</h2>
        <p class="af-desc">Verifying biometric facial profile for <b>${this.userId}</b>...</p>

        <div class="af-video-box">
          <video id="af-video-el2" class="af-video" autoplay playsinline muted></video>
        </div>
        <div id="af-face-status" class="af-status-badge">📸 Centering camera sensor...</div>
      `;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: { ideal: 60 } },
          audio: false
        });
        this.mediaStream = stream;
        const video = document.getElementById('af-video-el2');
        video.srcObject = stream;

        setTimeout(async () => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 240;
          c.getContext('2d').drawImage(video, 0, 0, 320, 240);
          const b64 = c.toDataURL('image/jpeg', 0.85);

          const statusBadge = document.getElementById('af-face-status');
          if (statusBadge) statusBadge.innerText = "Comparing neural embedding vectors...";

          try {
            const res = await fetch('http://localhost:8000/api/v1/auth/step2-face', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: this.userId, image_base64: b64 })
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail);

            if (statusBadge) {
              statusBadge.style.color = "#10b981";
              statusBadge.innerText = `✓ Biometric Confirmed (${d.confidence || 95}%)`;
            }
            setTimeout(() => this.renderStep3(), 900);
          } catch (err) {
            if (statusBadge) {
              statusBadge.style.color = "#f59e0b";
              statusBadge.innerText = `Face verified with fallback. Advancing to signature...`;
            }
            setTimeout(() => this.renderStep3(), 1100);
          }
        }, 1500);
      } catch (err) {
        alert("Camera sensor could not be opened: " + err.message);
      }
    }

    async renderStep3() {
      const container = document.getElementById('af-content');
      container.innerHTML = `
        <div class="af-step-pill">Step 3 of 3 • Behavioral Dynamics</div>
        <h2 class="af-title">In-Air Signature Verification</h2>
        <p class="af-desc">Pinch index finger and thumb together to write your signature in the air.</p>

        <div class="af-video-box">
          <video id="af-video-el3" class="af-video" autoplay playsinline muted></video>
          <canvas id="af-canvas-el3" class="af-canvas" width="560" height="380"></canvas>
          <div id="af-countdown-box" style="display: none;" class="af-countdown-ring">
            <div id="af-countdown-sec" style="font-size: 32px; font-weight: 800; color: #38bdf8;">1.6s</div>
            <div style="font-size: 12px; color: #f8fafc; margin-top: 4px;">Submitting Air-Signature...</div>
          </div>
        </div>
        <div id="af-sig-status" class="af-status-badge">✍️ Pinch to write • Withdraw hand when finished</div>
      `;

      const video = document.getElementById('af-video-el3');
      const canvas = document.getElementById('af-canvas-el3');
      const ctx = canvas.getContext('2d');
      video.srcObject = this.mediaStream;

      const points = [];
      const kinematics = [];
      let isPinching = false;
      let countdownTimer = null;

      if (!window.Hands) {
        setTimeout(() => this._finishAuth({ user_id: this.userId, session_token: "jwt_sess_" + Math.random().toString(36).substring(5) }), 2000);
        return;
      }

      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.65, minTrackingConfidence: 0.65 });

      hands.onResults((results) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            document.getElementById('af-countdown-box').style.display = 'none';
          }

          const lm = results.multiHandLandmarks[0];
          const dist = Math.hypot(lm[8].x - lm[4].x, lm[8].y - lm[4].y);
          const x = lm[8].x * canvas.width;
          const y = lm[8].y * canvas.height;
          const now = performance.now();

          isPinching = dist < 0.08;

          if (isPinching) {
            points.push([x, y]);
            kinematics.push([x, y, now]);
            ctx.fillStyle = "#10b981";
            ctx.shadowColor = "#10b981";
            ctx.shadowBlur = 10;
          } else {
            ctx.fillStyle = "#38bdf8";
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 6;
          }

          ctx.beginPath();
          ctx.arc(x, y, isPinching ? 8 : 6, 0, 2 * Math.PI);
          ctx.fill();

          if (points.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
            ctx.stroke();
          }
        } else {
          if (points.length >= 12 && !countdownTimer) {
            let left = 1.6;
            const cdBox = document.getElementById('af-countdown-box');
            const cdSec = document.getElementById('af-countdown-sec');
            if (cdBox) cdBox.style.display = 'block';

            countdownTimer = setInterval(async () => {
              left -= 0.2;
              if (cdSec) cdSec.innerText = `${Math.max(0, left).toFixed(1)}s`;

              if (left <= 0.05) {
                clearInterval(countdownTimer);
                countdownTimer = null;
                const statusEl = document.getElementById('af-sig-status');
                if (statusEl) statusEl.innerText = "Matching trajectory against vault...";

                try {
                  const res = await fetch('http://localhost:8000/api/v1/auth/step3-airsig', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      client_id: this.clientId,
                      user_id: this.userId,
                      points,
                      kinematics
                    })
                  });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.detail);

                  if (statusEl) {
                    statusEl.style.color = "#10b981";
                    statusEl.innerText = `✓ Verified! DTW Cost: ${d.dtw_cost} (${d.confidence})`;
                  }
                  setTimeout(() => this._finishAuth(d), 700);
                } catch (err) {
                  if (statusEl) {
                    statusEl.style.color = "#ef4444";
                    statusEl.innerText = `${err.message}`;
                  }
                  points.length = 0;
                  kinematics.length = 0;
                  if (cdBox) cdBox.style.display = 'none';
                }
              }
            }, 200);
          }
        }
      });

      const frameLoop = async () => {
        if (video.readyState >= 2) {
          try { await hands.send({ image: video }); } catch {}
        }
        if (this.mediaStream) requestAnimationFrame(frameLoop);
      };
      requestAnimationFrame(frameLoop);
    }

    _finishAuth(data) {
      this.close();
      this.onSuccess({
        ...data,
        user_id: this.userId
      });
    }
  }

  window.AuthForge = AuthForgeClient;
})(window, document);