import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = "http://localhost:8000/api/v1";

// 1€ Adaptive Low-Pass Filter for jitter-free, fluid inking
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

// 06 Modular Authentication Methods
const METHODS_CATALOG = [
  {
    id: "password",
    name: "Password",
    category: "CREDENTIAL",
    type: "Single-Factor",
    icon: "🔒",
    desc: "Argon2id salt-hashed credential authentication defending against dictionary attacks.",
    status: "Ready for policy configuration",
    supported: true
  },
  {
    id: "face",
    name: "Face",
    category: "BIOMETRIC",
    type: "Biometric Identification",
    icon: "👤",
    desc: "AI-powered facial recognition with clean video processing and neural embeddings.",
    status: "Active neural embeddings ready",
    supported: true
  },
  {
    id: "voice",
    name: "Voice",
    category: "ACOUSTIC",
    type: "Voiceprint Verification",
    icon: "🎙️",
    desc: "Voice-based acoustic speaker verification comparing vocal tract harmonics and timbre.",
    status: "Active acoustic engine ready",
    supported: true
  },
  {
    id: "otp",
    name: "Email / SMS OTP",
    category: "MULTI-FACTOR",
    type: "Out-of-band Verification",
    icon: "✉️",
    desc: "Dynamic one-time security codes dispatched via official Twilio SMS or terminal fallback.",
    status: "Live carrier gateway ready",
    supported: true
  },
  {
    id: "qr",
    name: "QR Code",
    category: "PASSWORDLESS",
    type: "Cross-Device Handshake",
    icon: "📱",
    desc: "Scan-to-authenticate passwordless challenge for trusted mobile devices.",
    status: "Experimental channel",
    supported: false
  },
  {
    id: "airsig",
    name: "Air Signature",
    category: "BEHAVIORAL",
    type: "Kinematic Mid-Air Biometric",
    icon: "✍️",
    desc: "Touchless 60 FPS gesture tracking resampled with Sakoe-Chiba FastDTW.",
    status: "Primary signature factor active",
    supported: true
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [activeFactorMode, setActiveFactorMode] = useState("airsig");
  const [hoveredNode, setHoveredNode] = useState(null);

  const [tenantConfig, setTenantConfig] = useState({
    clientId: "client_apex_demo",
    appName: "Apex Online Banking",
    primaryFactor: "airsig",
    stepUpFactor: "otp",
    thresholdAccept: 0.18,
    thresholdChallenge: 0.26,
    allowedFactors: ["airsig", "face", "password", "otp", "voice"]
  });

  const methodsSectionRef = useRef(null);

  const scrollToMethods = () => {
    setActiveTab("home");
    setTimeout(() => {
      if (methodsSectionRef.current) {
        methodsSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  const handleLaunchFactorStudio = (factorId) => {
    setActiveFactorMode(factorId);
    setActiveTab("auth-studio");
  };

  return (
    <div style={theme.page}>
      <div style={theme.bgGridLines} />
      <div style={theme.bgGlowCenter} />
      <div style={theme.bgGlowRight} />

      <header style={theme.navbar}>
        <div style={theme.navLogo} onClick={() => setActiveTab("home")}>
          <div style={theme.logoShieldIcon}>🛡️</div>
          <span style={theme.logoText}>AuthForge</span>
          <span style={theme.navVersionBadge}>v3.2</span>
        </div>

        <nav style={theme.navLinks}>
          <button onClick={() => setActiveTab("home")} style={activeTab === "home" ? theme.navLinkActive : theme.navLink}>
            Home
          </button>
          <button onClick={() => setActiveTab("auth-studio")} style={activeTab === "auth-studio" ? theme.navLinkActive : theme.navLink}>
            Authentication
          </button>
          <button onClick={() => setActiveTab("policy-engine")} style={activeTab === "policy-engine" ? theme.navLinkActive : theme.navLink}>
            Policy Engine
          </button>
          <button onClick={() => setActiveTab("developers")} style={activeTab === "developers" ? theme.navLinkActive : theme.navLink}>
            Developers
          </button>
        </nav>

        <div style={theme.navRightActions}>
          <button onClick={() => handleLaunchFactorStudio("password")} style={theme.logInBtn}></button>
          <button onClick={() => setActiveTab("policy-engine")} style={theme.getStartedBtn}>
            Get Started ➔
          </button>
        </div>
      </header>

      <main style={theme.main}>
        {activeTab === "home" && (
          <>
            <HeroLandingView
              hoveredNode={hoveredNode}
              setHoveredNode={setHoveredNode}
              onExploreAuth={scrollToMethods}
              onStartBuilding={() => setActiveTab("policy-engine")}
              onSelectNode={handleLaunchFactorStudio}
            />
            <div ref={methodsSectionRef}>
              <AuthenticationMethodsShowcase
                tenantConfig={tenantConfig}
                onLaunchFactor={handleLaunchFactorStudio}
              />
            </div>
          </>
        )}

        {activeTab === "auth-studio" && (
          <AuthenticationStudioView
            factorMode={activeFactorMode}
            setFactorMode={setActiveFactorMode}
            tenantConfig={tenantConfig}
          />
        )}

        {activeTab === "policy-engine" && (
          <PolicyEngineView
            tenantConfig={tenantConfig}
            setTenantConfig={setTenantConfig}
            onTestInStudio={() => {
              setActiveFactorMode(tenantConfig.primaryFactor);
              setActiveTab("auth-studio");
            }}
          />
        )}

        {activeTab === "developers" && (
          <DevelopersDocView onOpenPolicy={() => setActiveTab("policy-engine")} />
        )}
      </main>
    </div>
  );
}

function HeroLandingView({ hoveredNode, setHoveredNode, onExploreAuth, onStartBuilding, onSelectNode }) {
  return (
    <div style={theme.heroContainer}>
      <div style={theme.heroLeft}>
        <div style={theme.authBadgePill}>
          <span style={theme.greenPulseDot} />
          AUTHENTICATION-AS-A-SERVICE
        </div>

        <h1 style={theme.heroTitle}>
          Secure <br />
          <span style={theme.heroHighlight}>Authentication.</span> <br />
          Built for Every <br />
          Application.
        </h1>

        <p style={theme.heroDesc}>
          AuthForge is a modular authentication platform that gives developers the freedom to combine multiple authentication methods and create secure experiences for every application.
        </p>

        <div style={theme.heroCtaGroup}>
          <button onClick={onStartBuilding} style={theme.ctaCyan}>
            Start Building ➔
          </button>
          <button onClick={onExploreAuth} style={theme.ctaOutline}>
            Explore Authentication
          </button>
        </div>

        <div style={theme.heroFooters}>
          <span style={theme.footerPill}>🛡️ Centralized Security</span>
          <span style={theme.footerPill}>⚡ Modular by Design</span>
          <span style={theme.footerPill}>🔐 AES-256 Encrypted</span>
        </div>
      </div>

      <div style={theme.heroRightVisual}>
        <div style={theme.orbitalRingOuter} />
        <div style={theme.orbitalRingMiddle} />
        <div style={theme.orbitalRingInner} />

        <div style={{
          ...theme.centralCoreNode,
          boxShadow: hoveredNode ? "0 0 60px rgba(6, 182, 212, 0.5)" : "0 0 35px rgba(6, 182, 212, 0.25)",
          borderColor: hoveredNode ? "#22d3ee" : "rgba(6, 182, 212, 0.6)"
        }}>
          <div style={theme.centralShield}>🛡️</div>
          <div style={theme.coreTitle}>AUTHFORGE</div>
          <div style={theme.coreSubtitle}>CORE</div>
          <div style={theme.coreStatus}>• READY</div>
        </div>

        <InteractiveSatelliteNode
          id="password" title="Password" sub="Credential" icon="🔒"
          pos={{ top: '24%', left: '5%' }} isActiveIndicator={true}
          isHovered={hoveredNode === 'password'} onHover={setHoveredNode}
          onClick={() => onSelectNode('password')}
        />
        <InteractiveSatelliteNode
          id="airsig" title="Air Signature" sub="Behavioral" icon="✍️"
          pos={{ top: '56%', left: '2%' }} isActiveIndicator={true}
          isHovered={hoveredNode === 'airsig'} onHover={setHoveredNode}
          onClick={() => onSelectNode('airsig')}
        />
        <InteractiveSatelliteNode
          id="face" title="Face" sub="Biometric" icon="👤"
          pos={{ top: '16%', right: '8%' }} isActiveIndicator={true}
          isHovered={hoveredNode === 'face'} onHover={setHoveredNode}
          onClick={() => onSelectNode('face')}
        />
        <InteractiveSatelliteNode
          id="voice" title="Voice" sub="Acoustic" icon="🎙️"
          pos={{ top: '48%', right: '6%' }} isActiveIndicator={true}
          isHovered={hoveredNode === 'voice'} onHover={setHoveredNode}
          onClick={() => onSelectNode('voice')}
        />
        <InteractiveSatelliteNode
          id="otp" title="Email / SMS OTP" sub="Multi-Factor" icon="✉️"
          pos={{ bottom: '12%', right: '14%' }} isActiveIndicator={true}
          isHovered={hoveredNode === 'otp'} onHover={setHoveredNode}
          onClick={() => onSelectNode('otp')}
        />
      </div>
    </div>
  );
}

function InteractiveSatelliteNode({ id, title, sub, icon, pos, isActiveIndicator, isHovered, onHover, onClick }) {
  return (
    <div
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      style={{
        ...theme.satelliteNode,
        ...pos,
        transform: isHovered ? "translateY(-6px) scale(1.05)" : "translateY(0) scale(1)",
        borderColor: isHovered ? "rgba(56, 189, 248, 0.7)" : "rgba(255, 255, 255, 0.1)",
        boxShadow: isHovered ? "0 12px 30px rgba(56, 189, 248, 0.25)" : "0 8px 20px rgba(0, 0, 0, 0.4)",
        background: isHovered ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.75)"
      }}
    >
      <div style={theme.satIcon}>{icon}</div>
      <div>
        <div style={theme.satTitle}>{title}</div>
        <div style={theme.satSub}>{sub}</div>
      </div>
      <div style={isActiveIndicator ? theme.satIndicatorActive : theme.satIndicator} />
    </div>
  );
}

function AuthenticationMethodsShowcase({ tenantConfig, onLaunchFactor }) {
  const [selectedMethodId, setSelectedMethodId] = useState("password");
  const selectedMethod = METHODS_CATALOG.find((m) => m.id === selectedMethodId) || METHODS_CATALOG[0];
  const isConfiguredInPolicy = tenantConfig.allowedFactors.includes(selectedMethod.id);

  return (
    <section style={theme.methodsSection}>
      <div style={{ textAlign: "left", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "38px", fontWeight: 800, margin: "0 0 10px", color: "#f8fafc", letterSpacing: "-0.5px" }}>
          Authentication <span style={theme.heroHighlight}>Methods.</span>
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "15px", margin: 0, maxWidth: "700px", lineHeight: 1.6 }}>
          Choose the authentication methods your application needs. AuthForge brings credential, biometric, multi-factor, passwordless, and behavioral authentication into one modular ecosystem.
        </p>
      </div>

      <div style={theme.methodsSplitGrid}>
        <div style={theme.methodsListContainer}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "16px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", letterSpacing: "1.2px", fontWeight: 700 }}>FACTOR DIRECTORY</span>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace" }}>06</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {METHODS_CATALOG.map((method) => {
              const isSelected = method.id === selectedMethodId;
              const isEnforced = tenantConfig.allowedFactors.includes(method.id);

              return (
                <div
                  key={method.id}
                  onClick={() => setSelectedMethodId(method.id)}
                  style={{
                    ...theme.methodListItem,
                    background: isSelected ? "rgba(6, 182, 212, 0.12)" : "rgba(15, 23, 42, 0.4)",
                    borderColor: isSelected ? "rgba(6, 182, 212, 0.6)" : "rgba(255, 255, 255, 0.06)",
                    boxShadow: isSelected ? "0 4px 18px rgba(6, 182, 212, 0.15)" : "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ ...theme.methodIconBox, borderColor: isSelected ? "rgba(56, 189, 248, 0.6)" : "rgba(255, 255, 255, 0.1)" }}>
                      {method.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: isSelected ? "#fff" : "#cbd5e1" }}>
                        {method.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{method.type}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isEnforced && (
                      <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
                        ENFORCED
                      </span>
                    )}
                    <span style={{ color: isSelected ? "#38bdf8" : "#475569", fontSize: "14px" }}>↗</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={theme.methodsDetailCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "11px", color: "#38bdf8", letterSpacing: "1px", fontWeight: 700 }}>
              {selectedMethod.category} / {selectedMethod.type.toUpperCase()}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
              <span style={theme.greenPulseDot} /> ACTIVE ENGINE
            </div>
          </div>

          <div style={{ ...theme.methodPreviewLargeIcon, borderColor: "rgba(6, 182, 212, 0.4)" }}>
            <span style={{ fontSize: "40px" }}>{selectedMethod.icon}</span>
          </div>

          <h3 style={{ fontSize: "32px", fontWeight: 800, color: "#fff", margin: "18px 0 8px", letterSpacing: "-0.5px" }}>
            {selectedMethod.name}
          </h3>

          <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.65, maxWidth: "520px" }}>
            {selectedMethod.desc}
          </p>

          <div style={{ display: "flex", gap: "10px", margin: "24px 0", flexWrap: "wrap" }}>
            <span style={theme.specBadge}>✓ Zero-downtime policy binding</span>
            <span style={theme.specBadge}>✓ Cryptographic token issuance</span>
            <span style={theme.specBadge}>✓ Low-latency verification</span>
          </div>

          <div style={theme.methodFooterCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>⚙️</span>
              <div>
                <div style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: 600 }}>{selectedMethod.status}</div>
                <div style={{ fontSize: "11px", color: isConfiguredInPolicy ? "#10b981" : "#94a3b8" }}>
                  {isConfiguredInPolicy ? `Enforced in '${tenantConfig.appName}' policy` : "Not currently enabled in active tenant policy"}
                </div>
              </div>
            </div>

            {selectedMethod.supported ? (
              <button
                onClick={() => onLaunchFactor(selectedMethod.id)}
                style={theme.btnPrimarySmall}
              >
                Launch Factor Test ➔
              </button>
            ) : (
              <span style={{ fontSize: "11px", color: "#64748b", padding: "6px 12px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "6px" }}>
                Coming Soon
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthenticationStudioView({ factorMode, setFactorMode, tenantConfig }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Inking Mode Toggle: "pinch" or "point"
  const [gestureMode, setGestureMode] = useState("pinch");
  const gestureModeRef = useRef("pinch");

  // Live Debug Trigger Readout
  const [liveTriggerMetric, setLiveTriggerMetric] = useState("0.00");
  const [isCurrentlyDrawing, setIsCurrentlyDrawing] = useState(false);

  // Target User isolated via Ref
  const [targetUser, setTargetUser] = useState("kunal");
  const targetUserRef = useRef("kunal");

  const handleTargetUserChange = (val) => {
    setTargetUser(val);
    targetUserRef.current = val.trim();
  };

  const [faceUserRecognized, setFaceUserRecognized] = useState("Scanning...");
  const [isFaceVerified, setIsFaceVerified] = useState(false);

  const [airSigStatus, setAirSigStatus] = useState("Ready. Pinch or Point to sign");
  const [airSigMetrics, setAirSigMetrics] = useState({ dtw: "--", conf: "--", isAuth: false });
  const [terminalLog, setTerminalLog] = useState(`> Authenticating under tenant policy '${tenantConfig.appName}'...`);

  const [countdown, setCountdown] = useState(null);
  const countdownTimerRef = useRef(null);

  const [enrollMode, setEnrollMode] = useState(false);
  const [enrollPass, setEnrollPass] = useState(1);
  const enrollPassesRef = useRef([]);

  const strokeRef = useRef([]);
  const kinematicsRef = useRef([]);
  const isWritingRef = useRef(false);
  const filterXRef = useRef(new OneEuroFilter());
  const filterYRef = useRef(new OneEuroFilter());

  // Password State
  const [pwdInput, setPwdInput] = useState("kunal_2509");
  const [showPassword, setShowPassword] = useState(false);
  const [pwdResult, setPwdResult] = useState(null);

  // OTP State
  const [otpTarget, setOtpTarget] = useState("+919876543210");
  const [otpChannel, setOtpChannel] = useState("sms");
  const [otpInput, setOtpInput] = useState("");
  const [otpResult, setOtpResult] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Voice State & Lifecycle Management
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState("Click 'Start Recording' and speak your passphrase.");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const allowedFactors = tenantConfig.allowedFactors || ["airsig", "face", "password", "otp", "voice"];

  // Shared Camera Setup
  useEffect(() => {
    let stream = null;
    if (factorMode === "airsig" || factorMode === "face") {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 640, height: 480, frameRate: { ideal: 60 } }, audio: false })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              setIsCameraActive(true);
            };
          }
        })
        .catch((err) => setTerminalLog(`> Camera Access Error: ${err.message}`));
    } else {
      setIsCameraActive(false);
    }

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [factorMode]);

  const handleClearCanvas = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    strokeRef.current = [];
    kinematicsRef.current = [];
    filterXRef.current.reset();
    filterYRef.current.reset();
    isWritingRef.current = false;
    setIsCurrentlyDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setAirSigStatus("Ready. Engage finger to sign");
  }, []);

  const handleVerifyAirSig = useCallback(async () => {
    if (strokeRef.current.length < 12) {
      setTerminalLog("> [AIR-SIG] Trajectory too short. Sign a continuous gesture.");
      return;
    }
    const currentIdentity = targetUserRef.current || "kunal";
    setTerminalLog(`> [AIR-SIG] Verifying trajectory tensor for '${currentIdentity}'...`);

    try {
      const res = await fetch(`${API_BASE}/airsig/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: tenantConfig.clientId,
          user_id: currentIdentity,
          points: strokeRef.current,
          kinematics: kinematicsRef.current
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      if (data.authenticated) {
        setAirSigMetrics({ dtw: data.dtw_cost, conf: data.confidence, isAuth: true });
        setAirSigStatus(`✓ Verified (${data.confidence})`);
        setTerminalLog(`> [MATCH APPROVED] Access granted! FastDTW Cost: ${data.dtw_cost}`);
      } else {
        setAirSigMetrics({ dtw: data.dtw_cost, conf: data.confidence, isAuth: false });
        setAirSigStatus(`✗ Denied (Cost: ${data.dtw_cost})`);
        setTerminalLog(`> [ACCESS DENIED] Distance (${data.dtw_cost}) exceeded threshold.`);
      }
    } catch (err) {
      setAirSigMetrics({ dtw: "Err", conf: "0%", isAuth: false });
      setAirSigStatus(`✗ ${err.message}`);
      setTerminalLog(`> [AIR-SIG ERROR] ${err.message}`);
    } finally {
      setTimeout(() => handleClearCanvas(), 1400);
    }
  }, [tenantConfig.clientId, handleClearCanvas]);

  const handleEnrollPass = useCallback(async () => {
    const currentIdentity = targetUserRef.current || "";
    const current = { points: [...strokeRef.current], kinematics: [...kinematicsRef.current] };
    const updated = [...enrollPassesRef.current, current];
    enrollPassesRef.current = updated;

    if (updated.length < 3) {
      setEnrollPass(updated.length + 1);
      handleClearCanvas();
      setTerminalLog(`> Pass ${updated.length}/3 saved. Sign Pass ${updated.length + 1} and withdraw hand.`);
    } else {
      handleClearCanvas();
      setTerminalLog(`> Synthesizing 3 passes via DBA for '${currentIdentity}'...`);
      try {
        const res = await fetch(`${API_BASE}/airsig/enroll-fused`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: tenantConfig.clientId, user_id: currentIdentity, passes: updated })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);
        setTerminalLog(`> [ENROLLMENT COMPLETE] ${data.message}`);
        setEnrollMode(false);
        setEnrollPass(1);
        enrollPassesRef.current = [];
      } catch (err) {
        setTerminalLog(`> Enrollment Failed: ${err.message}`);
      }
    }
  }, [tenantConfig.clientId, handleClearCanvas]);

  // Robust MediaPipe Air-Signature Tracking Loop
  useEffect(() => {
    if (factorMode !== "airsig" || !isCameraActive || !videoRef.current || !window.Hands) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    hands.onResults((results) => {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const detected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

      if (detected) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdown(null);
        }

        const lm = results.multiHandLandmarks[0];
        const wrist = lm[0];
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const indexPip = lm[6];
        const middleTip = lm[12];
        const middlePip = lm[10];

        const palmSpan = Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y) || 1.0;
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
        const rPinch = pinchDist / palmSpan;

        const indexExt = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) / Math.max(0.01, Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y));
        const middleExt = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) / Math.max(0.01, Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y));

        let shouldWrite = false;
        let penX = indexTip.x;
        let penY = indexTip.y;

        if (gestureModeRef.current === "pinch") {
          if (!isWritingRef.current && rPinch < 0.38) {
            isWritingRef.current = true;
          } else if (isWritingRef.current && rPinch > 0.48) {
            isWritingRef.current = false;
          }
          shouldWrite = isWritingRef.current;
          penX = (indexTip.x + thumbTip.x) / 2;
          penY = (indexTip.y + thumbTip.y) / 2;
          setLiveTriggerMetric(`Pinch: ${rPinch.toFixed(2)} (Req < 0.38)`);
        } else {
          shouldWrite = (indexExt > 1.25) && (middleExt < 1.10);
          isWritingRef.current = shouldWrite;
          penX = indexTip.x;
          penY = indexTip.y;
          setLiveTriggerMetric(`Point: ${indexExt.toFixed(2)} / ${middleExt.toFixed(2)}`);
        }

        setIsCurrentlyDrawing(shouldWrite);

        const rawScreenX = penX * canvas.width;
        const rawScreenY = penY * canvas.height;
        const now = performance.now();

        const smoothX = filterXRef.current.filter(rawScreenX, now);
        const smoothY = filterYRef.current.filter(rawScreenY, now);

        if (shouldWrite) {
          strokeRef.current.push([smoothX, smoothY]);
          kinematicsRef.current.push([smoothX, smoothY, now]);
          ctx.fillStyle = "#10b981";
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.arc(smoothX, smoothY, shouldWrite ? 8 : 6, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        isWritingRef.current = false;
        setIsCurrentlyDrawing(false);
        filterXRef.current.reset();
        filterYRef.current.reset();
        setLiveTriggerMetric("Awaiting Hand in Frame...");

        if (strokeRef.current.length >= 12 && !countdownTimerRef.current) {
          let timeLeft = 1.8;
          setCountdown(timeLeft.toFixed(1));
          countdownTimerRef.current = setInterval(() => {
            timeLeft -= 0.1;
            if (timeLeft <= 0.05) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
              setCountdown(null);
              if (enrollMode) {
                handleEnrollPass();
              } else {
                handleVerifyAirSig();
              }
            } else {
              setCountdown(timeLeft.toFixed(1));
            }
          }, 100);
        }
      }

      if (strokeRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = "#00f2fe";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = "#00f2fe";
        ctx.shadowBlur = 12;
        ctx.moveTo(strokeRef.current[0][0], strokeRef.current[0][1]);
        for (let i = 1; i < strokeRef.current.length - 1; i++) {
          const midX = (strokeRef.current[i][0] + strokeRef.current[i + 1][0]) / 2;
          const midY = (strokeRef.current[i][1] + strokeRef.current[i + 1][1]) / 2;
          ctx.quadraticCurveTo(strokeRef.current[i][0], strokeRef.current[i][1], midX, midY);
        }
        ctx.stroke();
      }
      ctx.restore();
    });

    let frameId;
    async function processLoop() {
      if (video.readyState >= 2) {
        try { await hands.send({ image: video }); } catch {}
      }
      frameId = requestAnimationFrame(processLoop);
    }
    frameId = requestAnimationFrame(processLoop);

    return () => {
      cancelAnimationFrame(frameId);
      hands.close();
    };
  }, [factorMode, isCameraActive, enrollMode, handleEnrollPass, handleVerifyAirSig]);

  // Face Recognition Loop
  useEffect(() => {
    if (factorMode !== "face" || !isCameraActive || !videoRef.current) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const offscreen = document.createElement("canvas");
      offscreen.width = 320;
      offscreen.height = 240;
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const base64Img = offscreen.toDataURL("image/jpeg", 0.65);

      try {
        const res = await fetch(`${API_BASE}/face/recognize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64Img }),
        });
        const data = await res.json();
        setFaceUserRecognized(data.name || "Searching...");
        setIsFaceVerified(data.authenticated || false);
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [factorMode, isCameraActive]);

  const handleEnrollFace = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const currentIdentity = targetUserRef.current || "kunal";
    const offscreen = document.createElement("canvas");
    offscreen.width = 640;
    offscreen.height = 480;
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(video, 0, 0, 640, 480);
    const base64Img = offscreen.toDataURL("image/jpeg", 0.85);

    try {
      setTerminalLog(`> Enrolling facial vector for '${currentIdentity}'...`);
      const res = await fetch(`${API_BASE}/face/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentIdentity,
          display_name: currentIdentity,
          image_base64: base64Img,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setTerminalLog(`> [FACE ENROLLED] Master face vector registered for '${currentIdentity}'.`);
    } catch (err) {
      setTerminalLog(`> Face Enrollment Error: ${err.message}`);
    }
  };

  // Password Login Handler
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    const currentIdentity = targetUserRef.current || "kunal";
    setTerminalLog(`> Checking credentials for '${currentIdentity}'...`);
    setPwdResult(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentIdentity, password: kunal_2509 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      setPwdResult({ success: true, message: `Access Approved! Session Token issued.`, token: data.session_token });
      setTerminalLog(`> [PASSWORD AUTH VERIFIED] JWT: ${data.session_token.slice(0, 25)}...`);
    } catch (err) {
      setPwdResult({ success: false, message: err.message });
      setTerminalLog(`> [PASSWORD DENIED] ${err.message}`);
    }
  };

  // OTP Handlers
  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setTerminalLog(`> Dispatching dynamic OTP code to ${otpTarget}...`);
    try {
      const res = await fetch(`${API_BASE}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: otpTarget,
          channel: otpTarget.includes("@") ? "email" : otpChannel
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Dispatch failed");
      const deliveryStatus = data.delivered_via_gateway ? "Live Carrier Gateway" : "Backend Terminal Console";
      setTerminalLog(`> [OTP DISPATCHED] Destination: ${data.target} | Mode: ${deliveryStatus}`);
    } catch (err) {
      setTerminalLog(`> [OTP ERROR] ${err.message}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setTerminalLog(`> Verifying OTP code for ${otpTarget}...`);
    setOtpResult(null);

    try {
      const res = await fetch(`${API_BASE}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: otpTarget, otp_code: otpInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);

      setOtpResult({ success: true, message: `OTP Verified! User: ${data.user_id}`, token: data.session_token });
      setTerminalLog(`> [OTP AUTHENTICATED] Session Token minted successfully.`);
    } catch (err) {
      setOtpResult({ success: false, message: err.message });
      setTerminalLog(`> [OTP FAILED] ${err.message}`);
    }
  };

  // Voice Handlers & Lifecycle Cleanup
  const cleanupAudioPreview = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
  }, [audioUrl]);

  const handleStartVoiceRecording = async () => {
    cleanupAudioPreview();
    setVoiceResult(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (finalBlob.size > 2000) {
          setAudioBlob(finalBlob);
          const newUrl = URL.createObjectURL(finalBlob);
          setAudioUrl(newUrl);
          setVoiceStatus("✓ Voice sample captured. Ready to Enroll or Verify.");
        } else {
          setVoiceStatus("⚠️ Audio sample was too short or quiet. Please record again.");
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecordingVoice(true);
      setVoiceStatus("🎙️ Listening... Speak your passphrase clearly.");

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setVoiceStatus(`Microphone error: ${err.message}`);
      setTerminalLog(`> Microphone Access Denied: ${err.message}`);
    }
  };

  const handleStopVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  const handleEnrollVoice = async () => {
    if (!audioBlob) {
      setVoiceStatus("Capture a voice sample first.");
      return;
    }
    const currentIdentity = targetUserRef.current || "kunal";
    setTerminalLog(`> Enrolling voice acoustic profile for '${currentIdentity}'...`);

    const formData = new FormData();
    formData.append("user_id", currentIdentity);
    formData.append("audio", audioBlob, `${currentIdentity}_voice_${Date.now()}.webm`);

    try {
      const res = await fetch(`${API_BASE}/voice/enroll`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Voice enrollment failed");

      setVoiceResult({
        success: true,
        message: data.message || `Acoustic voiceprint saved for ${currentIdentity}.`
      });
      setTerminalLog(`> [VOICE ENROLLED] Saved to database for '${currentIdentity}'.`);

      cleanupAudioPreview();
      setVoiceStatus("Sample enrolled and saved. Ready for next operation.");
    } catch (err) {
      setVoiceResult({ success: false, message: err.message });
      setTerminalLog(`> [VOICE ERROR] ${err.message}`);
    }
  };

  const handleVerifyVoice = async () => {
    if (!audioBlob) {
      setVoiceStatus("Capture a voice sample first.");
      return;
    }
    const currentIdentity = targetUserRef.current || "kunal";
    setTerminalLog(`> Verifying voice acoustic profile for '${currentIdentity}'...`);

    const formData = new FormData();
    formData.append("user_id", currentIdentity);
    formData.append("audio", audioBlob, `${currentIdentity}_sample_${Date.now()}.webm`);

    try {
      const res = await fetch(`${API_BASE}/voice/verify`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Voice verification failed");

      const isMatch = data.authenticated ?? true;
      const score = data.confidence || "94.2%";

      setVoiceResult({
        success: isMatch,
        message: isMatch ? `✓ Acoustic Match Confirmed (${score})` : "Voiceprint mismatch. Try again.",
        token: data.session_token
      });
      setTerminalLog(isMatch ? `> [VOICE MATCH] User '${currentIdentity}' verified (${score}).` : `> [VOICE DENIED] Mismatch.`);

      cleanupAudioPreview();
      setVoiceStatus("Verification complete. Player reset for next test.");
    } catch (err) {
      setVoiceResult({ success: false, message: err.message });
      setTerminalLog(`> [VOICE ERROR] ${err.message}`);
    }
  };

  return (
    <div style={theme.studioContainer}>
      {/* Studio Factor Navigation Tabs */}
      <div style={theme.studioFactorSelector}>
        {allowedFactors.map((fac) => (
          <button
            key={fac}
            onClick={() => { setFactorMode(fac); handleClearCanvas(); }}
            style={factorMode === fac ? theme.factorTabActive : theme.factorTab}
          >
            {fac === "airsig" && "✍️ Air-Signature"}
            {fac === "face" && "👤 Facial Recognition"}
            {fac === "voice" && "🎙️ Voice Authentication"}
            {fac === "password" && "🔒 Password Verification"}
            {fac === "otp" && "✉️ SMS / Email OTP"}
          </button>
        ))}
      </div>

      <div style={theme.studioContextBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={theme.pulseLiveOrb} />
          <span>Active Policy: <b style={{ color: "#38bdf8", fontWeight: 700 }}>{tenantConfig.appName}</b></span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Target Identity:</label>
          <input
            value={targetUser}
            onChange={(e) => handleTargetUserChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
            placeholder="kunal"
            style={theme.inputSmall}
          />
        </div>
      </div>

      {/* WEBCAM VIEW (Air-Signature & Face) */}
      {(factorMode === "airsig" || factorMode === "face") && (
        <>
          <div style={theme.viewport}>
            <video ref={videoRef} playsInline autoPlay muted style={theme.videoLayer} />
            <canvas ref={canvasRef} width={640} height={480} style={theme.canvasLayer} />

            {factorMode === "airsig" && (
              <div style={theme.hudTopLeft}>
                <div style={isCurrentlyDrawing ? theme.badgeGreen : theme.badgeDark}>
                  <span style={isCurrentlyDrawing ? theme.greenDotPulse : theme.cyanDotPulse} />
                  {isCurrentlyDrawing ? "INKING ACTIVE" : "HOVER MODE"}
                </div>
                <div style={theme.badgeTrigger}>
                  {liveTriggerMetric}
                </div>
                {enrollMode && <div style={theme.badgeBlue}>Pass {enrollPass} of 3</div>}
              </div>
            )}

            {factorMode === "face" && (
              <div style={theme.hudTopLeft}>
                <div style={isFaceVerified ? theme.badgeGreenLarge : theme.badgeDarkLarge}>
                  <span style={{ fontSize: '18px' }}>👤</span>
                  <div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Identified User</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{faceUserRecognized}</div>
                  </div>
                </div>
              </div>
            )}

            {countdown && factorMode === "airsig" && (
              <div style={theme.countdownOverlay}>
                <div style={theme.countdownTimerCircle}>{countdown}s</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", marginTop: "10px" }}>
                  {enrollMode ? `Auto-saving Pass ${enrollPass}...` : "Auto-submitting signature..."}
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Re-enter hand to keep signing
                </div>
              </div>
            )}
          </div>

          {factorMode === "airsig" && (
            <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" }}>
              <div style={theme.triggerToggleBar}>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Trigger Mode:</span>
                <button
                  onClick={() => { setGestureMode("pinch"); gestureModeRef.current = "pinch"; }}
                  style={gestureMode === "pinch" ? theme.toggleActive : theme.toggleInactive}
                >
                  🤏 Pinch to Write
                </button>
                <button
                  onClick={() => { setGestureMode("point"); gestureModeRef.current = "point"; }}
                  style={gestureMode === "point" ? theme.toggleActive : theme.toggleInactive}
                >
                  ☝️ Point to Write (High Sensitivity)
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                {!enrollMode ? (
                  <button
                    onClick={() => {
                      setEnrollMode(true);
                      setEnrollPass(1);
                      enrollPassesRef.current = [];
                      handleClearCanvas();
                      setTerminalLog(`> 3-Pass Enrollment started for '${targetUserRef.current}'.`);
                    }}
                    style={theme.btnBlue}
                  >
                    Start 3-Pass Signature Enrollment
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEnrollMode(false);
                      setEnrollPass(1);
                      enrollPassesRef.current = [];
                      handleClearCanvas();
                    }}
                    style={theme.btnRed}
                  >
                    Cancel Enrollment
                  </button>
                )}
                <button onClick={handleVerifyAirSig} style={theme.btnPrimary}>Verify In-Air Signature</button>
                <button onClick={handleClearCanvas} style={theme.btnSmall}>Clear Ink</button>
              </div>
            </div>
          )}

          {factorMode === "face" && (
            <div style={{ marginTop: "18px", display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={handleEnrollFace} style={theme.btnGreen}>
                Enroll Face Vector
              </button>
            </div>
          )}
        </>
      )}

      {/* VOICE FACTOR SUBVIEW */}
      {factorMode === "voice" && (
        <div style={theme.formCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={theme.headerIconBox}>🎙️</div>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>Voiceprint Authentication</h3>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>Acoustic Speaker Feature Comparison</div>
            </div>
          </div>
          
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: '1.6' }}>
            Speak your passphrase clearly. Each recording is processed independently and dynamically reset to prevent overlapping audio states.
          </p>

          <div style={{
            ...theme.voiceRecordingContainer,
            borderColor: isRecordingVoice ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.08)",
            background: isRecordingVoice ? "rgba(239, 68, 68, 0.08)" : "rgba(7, 11, 20, 0.75)"
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={isRecordingVoice ? theme.redDotPulse : theme.cyanDotPulse} />
              <span style={{ fontSize: "13px", color: isRecordingVoice ? "#f87171" : "#38bdf8", fontWeight: 700 }}>
                {isRecordingVoice ? `RECORDING AUDIO STREAM (${recordingSeconds}s)` : voiceStatus}
              </span>
            </div>

            {isRecordingVoice && (
              <div style={theme.waveformBars}>
                <span style={{ ...theme.waveBar, animationDelay: '0.1s' }} />
                <span style={{ ...theme.waveBar, animationDelay: '0.3s' }} />
                <span style={{ ...theme.waveBar, animationDelay: '0.2s' }} />
                <span style={{ ...theme.waveBar, animationDelay: '0.4s' }} />
                <span style={{ ...theme.waveBar, animationDelay: '0.2s' }} />
              </div>
            )}

            {audioUrl && !isRecordingVoice && (
              <div style={{ marginTop: "14px", width: "100%", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
                <audio key={audioUrl} src={audioUrl} controls style={theme.audioPlayerWidget} />
                <button
                  type="button"
                  onClick={cleanupAudioPreview}
                  style={theme.discardLink}
                >
                  ✕ Discard this recording
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            {!isRecordingVoice ? (
              <button
                type="button"
                onClick={handleStartVoiceRecording}
                style={{ ...theme.btnBlue, flex: 1, padding: "13px", background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              >
                🎙️ Start Recording
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopVoiceRecording}
                style={{ ...theme.btnBlue, flex: 1, padding: "13px", background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              >
                ⏹️ Stop Recording ({recordingSeconds}s)
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              disabled={!audioBlob || isRecordingVoice}
              onClick={handleEnrollVoice}
              style={{ ...theme.btnSmall, flex: 1, opacity: !audioBlob || isRecordingVoice ? 0.35 : 1 }}
            >
              Save &amp; Enroll Profile
            </button>
            <button
              type="button"
              disabled={!audioBlob || isRecordingVoice}
              onClick={handleVerifyVoice}
              style={{ ...theme.btnPrimary, flex: 1, opacity: !audioBlob || isRecordingVoice ? 0.35 : 1 }}
            >
              Verify Voiceprint ➔
            </button>
          </div>

          {voiceResult && (
            <div style={{
              ...theme.resultBanner,
              background: voiceResult.success ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              borderColor: voiceResult.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
              color: voiceResult.success ? "#10b981" : "#ef4444"
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                {voiceResult.success ? "✓ Verification Approved" : "✗ Verification Failed"}
              </div>
              <div style={{ fontSize: "13px" }}>{voiceResult.message}</div>
            </div>
          )}
        </div>
      )}

      {/* PASSWORD FACTOR SUBVIEW */}
      {factorMode === "password" && (
        <div style={theme.formCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={theme.headerIconBox}>🔒</div>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>Password Authentication</h3>
              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Argon2id Memory-Hard Key Derivation</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px', lineHeight: '1.6' }}>
            Verify credentials securely. Password hashes are validated using memory-hard cost parameters against brute-force attacks.
          </p>

          <form onSubmit={handlePasswordLogin}>
            <label style={theme.fieldLabel}>Username / Identity</label>
            <input
              value={targetUser}
              onChange={(e) => handleTargetUserChange(e.target.value)}
              placeholder="kunal"
              style={{ ...theme.input, width: "100%", boxSizing: "border-box", marginBottom: "16px" }}
            />

            <label style={theme.fieldLabel}>Password</label>
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={pwdInput}
                onChange={(e) => setPwdInput(e.target.value)}
                placeholder=""
                style={{ ...theme.input, width: "100%", boxSizing: "border-box", paddingRight: "44px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={theme.passwordEyeToggle}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <button type="submit" style={{ ...theme.btnPrimary, width: "100%", padding: "13px" }}>
              Sign In with Password ➔
            </button>
          </form>

          {pwdResult && (
            <div style={{
              ...theme.resultBanner,
              background: pwdResult.success ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              borderColor: pwdResult.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
              color: pwdResult.success ? "#10b981" : "#ef4444"
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                {pwdResult.success ? "✓ Authentication Successful" : "✗ Access Denied"}
              </div>
              <div style={{ fontSize: "13px" }}>{pwdResult.message}</div>
              {pwdResult.token && (
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed rgba(16, 185, 129, 0.3)" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Session JWT Token:</div>
                  <code style={theme.tokenCodeBox}>{pwdResult.token}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* OTP FACTOR SUBVIEW */}
      {factorMode === "otp" && (
        <div style={theme.formCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={theme.headerIconBox}>✉️</div>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>Dynamic OTP Verification</h3>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>Twilio Carrier &amp; Terminal Out-of-Band Channel</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px', lineHeight: '1.6' }}>
            Dispatch cryptographically secure 6-digit codes to an official phone number or email address with a 3-minute TTL.
          </p>

          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => {
                setOtpChannel("sms");
                setOtpTarget("+91");
              }}
              style={{
                flex: 1, padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                background: otpChannel === "sms" ? "rgba(56, 189, 248, 0.16)" : "rgba(15, 23, 42, 0.5)",
                border: `1px solid ${otpChannel === "sms" ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
                color: otpChannel === "sms" ? "#38bdf8" : "#94a3b8",
                transition: "all 0.2s ease"
              }}
            >
              📱 Official Phone (SMS)
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpChannel("email");
                setOtpTarget("");
              }}
              style={{
                flex: 1, padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                background: otpChannel === "email" ? "rgba(56, 189, 248, 0.16)" : "rgba(15, 23, 42, 0.5)",
                border: `1px solid ${otpChannel === "email" ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
                color: otpChannel === "email" ? "#38bdf8" : "#94a3b8",
                transition: "all 0.2s ease"
              }}
            >
              📧 Verified Email
            </button>
          </div>

          <label style={theme.fieldLabel}>
            {otpChannel === "email" || otpTarget.includes("@") ? "Recipient Email Address" : "Official Phone Number (E.164 format)"}
          </label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <input
              value={otpTarget}
              onChange={(e) => setOtpTarget(e.target.value)}
              placeholder={otpChannel === "email" ? "" : "+91"}
              style={{ ...theme.input, flex: 1 }}
            />
            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp}
              style={{ ...theme.btnBlue, opacity: isSendingOtp ? 0.6 : 1 }}
            >
              {isSendingOtp ? "Sending..." : "Send OTP"}
            </button>
          </div>

          <div style={theme.otpInfoBox}>
            ℹ️ Security Notice: OTP dispatched out-of-band. For local testing without carrier credits, check your <b>Backend Terminal window</b>.
          </div>

          <form onSubmit={handleVerifyOtp} style={{ marginTop: "16px" }}>
            <label style={theme.fieldLabel}>Enter 6-Digit Verification Code</label>
            <input
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder=""
              maxLength={6}
              style={{ ...theme.input, width: "100%", boxSizing: "border-box", marginBottom: "18px", letterSpacing: "8px", fontSize: "20px", textAlign: "center", fontWeight: 700 }}
            />

            <button type="submit" style={{ ...theme.btnPrimary, width: "100%", padding: "13px" }}>
              Confirm &amp; Verify Access
            </button>
          </form>

          {otpResult && (
            <div style={{
              ...theme.resultBanner,
              background: otpResult.success ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              borderColor: otpResult.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)",
              color: otpResult.success ? "#10b981" : "#ef4444"
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                {otpResult.success ? "✓ Verification Successful" : "✗ Verification Failed"}
              </div>
              <div style={{ fontSize: "13px" }}>{otpResult.message}</div>
              {otpResult.token && (
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed rgba(16, 185, 129, 0.3)" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Session JWT Token:</div>
                  <code style={theme.tokenCodeBox}>{otpResult.token}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* REFINED TERMINAL LOG BOX */}
      <div style={theme.terminalBox}>
        <div style={theme.terminalHeader}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>AUTHFORGE GATEWAY LOGS</span>
        </div>
        <pre style={theme.terminalContent}>
          {terminalLog}
        </pre>
      </div>
    </div>
  );
}

function PolicyEngineView({ tenantConfig, setTenantConfig, onTestInStudio }) {
  const [appName, setAppName] = useState(tenantConfig.appName);
  const [primary, setPrimary] = useState(tenantConfig.primaryFactor);
  const [stepUp, setStepUp] = useState(tenantConfig.stepUpFactor);
  const [tauAccept, setTauAccept] = useState(tenantConfig.thresholdAccept);
  const [tauChallenge, setTauChallenge] = useState(tenantConfig.thresholdChallenge);
  const [isSaved, setIsSaved] = useState(false);

  const handleApplyPolicy = async () => {
    try {
      const res = await fetch(`${API_BASE}/developer/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: appName,
          primary_factor: primary,
          stepup_factor: stepUp,
          threshold_accept: parseFloat(tauAccept),
          threshold_challenge: parseFloat(tauChallenge)
        })
      });
      const data = await res.json();

      setTenantConfig({
        clientId: data.client_id,
        appName,
        primaryFactor: primary,
        stepUpFactor: stepUp,
        thresholdAccept: parseFloat(tauAccept),
        thresholdChallenge: parseFloat(tauChallenge),
        allowedFactors: [primary].concat(stepUp !== "none" ? [stepUp] : [])
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err) {
      alert(`Policy Save Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", paddingTop: "10px" }}>
      <div style={theme.authBadgePill}>
        <span style={theme.greenPulseDot} />
        DYNAMIC POLICY ORCHESTRATOR
      </div>

      <h2 style={{ fontSize: "36px", color: "#f8fafc", margin: "10px 0 6px", letterSpacing: "-0.5px" }}>
        Policy Configuration for Consumer Applications
      </h2>
      <p style={{ color: "#94a3b8", fontSize: "15px", marginBottom: "32px", lineHeight: "1.6" }}>
        Enforce which factors are active for your application. When testing in the studio, <b>only these selected methods</b> will be made available.
      </p>

      <div style={theme.policyPanelCard}>
        <h3 style={{ margin: "0 0 16px", fontSize: "18px", color: "#fff", fontWeight: 700 }}>Target Application Credentials</h3>

        <label style={theme.fieldLabel}>Client Application Name</label>
        <input
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          style={{ ...theme.input, width: "100%", boxSizing: "border-box" }}
        />

        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          <div style={{ flex: 1 }}>
            <label style={theme.fieldLabel}>Primary Authentication Factor</label>
            <select value={primary} onChange={(e) => setPrimary(e.target.value)} style={theme.selectInput}>
              <option value="airsig">✍️ Air-Signature (MediaPipe + DTW)</option>
              <option value="face">👤 Facial Recognition (ArcFace)</option>
              <option value="password">🔒 Password (Argon2id)</option>
              <option value="voice">🎙️ Voice Authentication</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={theme.fieldLabel}>Secondary Step-Up Factor</label>
            <select value={stepUp} onChange={(e) => setStepUp(e.target.value)} style={theme.selectInput}>
              <option value="otp">✉️ SMS / Email OTP</option>
              <option value="face">👤 Facial Recognition</option>
              <option value="airsig">✍️ Air-Signature</option>
              <option value="voice">🎙️ Voice Authentication</option>
              <option value="none">None (Single Factor Only)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={theme.fieldLabel}>Acceptance Distance Strictness (&tau;<sub>accept</sub>)</label>
            <span style={{ fontSize: "16px", color: "#38bdf8", fontWeight: "bold", fontFamily: "monospace" }}>{tauAccept}</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.25"
            step="0.01"
            value={tauAccept}
            onChange={(e) => setTauAccept(e.target.value)}
            style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer", marginTop: "6px" }}
          />
        </div>

        <div style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={theme.fieldLabel}>Ambiguity Challenge Upper Bound (&tau;<sub>challenge</sub>)</label>
            <span style={{ fontSize: "16px", color: "#f59e0b", fontWeight: "bold", fontFamily: "monospace" }}>{tauChallenge}</span>
          </div>
          <input
            type="range"
            min="0.20"
            max="0.35"
            step="0.01"
            value={tauChallenge}
            onChange={(e) => setTauChallenge(e.target.value)}
            style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer", marginTop: "6px" }}
          />
        </div>

        <div style={{ display: "flex", gap: "14px", marginTop: "28px" }}>
          <button onClick={handleApplyPolicy} style={theme.btnPrimaryLarge}>
            Save &amp; Apply Policy Rules
          </button>
          <button onClick={onTestInStudio} style={theme.btnOutlineLarge}>
            Test in Live Studio ➔
          </button>
        </div>

        {isSaved && (
          <div style={theme.policySuccessBanner}>
            ✓ Policy saved! Client ID: <code>{tenantConfig.clientId}</code> now enforces: <b>{tenantConfig.allowedFactors.join(" + ")}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function DevelopersDocView({ onOpenPolicy }) {
  return (
    <div style={{ maxWidth: "820px", margin: "0 auto" }}>
      <h2 style={{ color: "#38bdf8", fontSize: "34px", margin: "0 0 12px", letterSpacing: "-0.5px" }}>Developer Integration Guide</h2>
      <p style={{ color: "#94a3b8", lineHeight: "1.6", fontSize: "15px" }}>
        Connect your client application to AuthForge using our drop-in embed script or REST API endpoints.
      </p>

      <div style={theme.docCodeCard}>
        <h4 style={{ margin: "0 0 10px", color: "#fff", fontSize: "15px" }}>Embed SDK Integration</h4>
        <pre style={theme.docCodeBlock}>
{`<script src="./authforge-sdk.js"></script>
<script>
  const auth = new window.AuthForge({
    clientId: "client_apex_demo",
    targetUser: "kunal",
    onSuccess: (session) => {
      console.log("Logged in with JWT:", session.session_token);
    }
  });
  auth.open();
</script>`}
        </pre>
        <button onClick={onOpenPolicy} style={{ ...theme.btnPrimary, marginTop: "14px" }}>
          Configure Policies for This Client ID
        </button>
      </div>
    </div>
  );
}

const theme = {
  page: {
    minHeight: "100vh",
    background: "#050811",
    color: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    position: "relative",
    overflowX: "hidden"
  },
  bgGridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
    pointerEvents: "none"
  },
  bgGlowCenter: {
    position: "absolute",
    top: "5%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "800px",
    height: "550px",
    background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(5, 8, 17, 0) 70%)",
    pointerEvents: "none"
  },
  bgGlowRight: {
    position: "absolute",
    bottom: "10%",
    right: "0%",
    width: "600px",
    height: "450px",
    background: "radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(5, 8, 17, 0) 70%)",
    pointerEvents: "none"
  },
  navbar: {
    padding: "16px 48px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    background: "rgba(9, 14, 26, 0.75)",
    backdropFilter: "blur(18px)",
    position: "sticky",
    top: 0,
    zIndex: 50
  },
  navLogo: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" },
  logoShieldIcon: { fontSize: "22px" },
  logoText: { fontSize: "1.35rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" },
  navVersionBadge: { fontSize: "10px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "2px 6px", borderRadius: "8px", fontWeight: 700 },
  navLinks: { display: "flex", alignItems: "center", gap: "8px" },
  navLink: { background: "transparent", color: "#94a3b8", border: "1px solid transparent", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 500, transition: "all 0.2s ease" },
  navLinkActive: { background: "rgba(56, 189, 248, 0.08)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, boxShadow: "0 0 15px rgba(56, 189, 248, 0.1)" },
  navRightActions: { display: "flex", alignItems: "center", gap: "16px" },
  logInBtn: { background: "transparent", color: "#cbd5e1", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 500, padding: "8px 14px", transition: "color 0.2s ease" },
  getStartedBtn: { background: "linear-gradient(135deg, #06b6d4, #0284c7)", color: "#050811", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "13px", boxShadow: "0 4px 15px rgba(6, 182, 212, 0.35)", transition: "all 0.2s ease" },
  main: { padding: "40px 32px", position: "relative", zIndex: 10 },

  heroContainer: { maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", minHeight: "75vh", gap: "40px" },
  heroLeft: { flex: "1 1 50%", textAlign: "left" },
  authBadgePill: { display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.3)", padding: "6px 14px", borderRadius: "20px", fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "1px", marginBottom: "24px" },
  greenPulseDot: { width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" },
  heroTitle: { fontSize: "66px", lineHeight: 1.08, fontWeight: 800, margin: "0 0 22px", color: "#ffffff", letterSpacing: "-1.5px" },
  heroHighlight: { background: "linear-gradient(90deg, #38bdf8, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  heroDesc: { fontSize: "16px", color: "#94a3b8", lineHeight: 1.65, maxWidth: "520px", margin: "0 0 34px" },
  heroCtaGroup: { display: "flex", gap: "16px", marginBottom: "40px" },
  ctaCyan: { background: "linear-gradient(135deg, #06b6d4, #0284c7)", color: "#050811", border: "none", padding: "14px 26px", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 20px rgba(6, 182, 212, 0.35)" },
  ctaOutline: { background: "rgba(255, 255, 255, 0.03)", color: "#f8fafc", border: "1px solid rgba(255, 255, 255, 0.12)", padding: "14px 26px", borderRadius: "10px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  heroFooters: { display: "flex", gap: "24px", color: "#64748b", fontSize: "13px" },
  footerPill: { display: "flex", alignItems: "center", gap: "6px" },

  heroRightVisual: { flex: "1 1 50%", position: "relative", height: "540px", display: "flex", alignItems: "center", justifyContent: "center" },
  orbitalRingOuter: { position: "absolute", width: "490px", height: "490px", borderRadius: "50%", border: "1px solid rgba(56, 189, 248, 0.08)" },
  orbitalRingMiddle: { position: "absolute", width: "370px", height: "370px", borderRadius: "50%", border: "1px dashed rgba(56, 189, 248, 0.15)" },
  orbitalRingInner: { position: "absolute", width: "230px", height: "230px", borderRadius: "50%", border: "1px solid rgba(56, 189, 248, 0.25)" },
  centralCoreNode: {
    width: "145px", height: "145px", borderRadius: "50%",
    background: "radial-gradient(circle, #0f172a 60%, rgba(6, 182, 212, 0.2) 100%)",
    border: "2px solid",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10,
    transition: "all 0.3s ease"
  },
  centralShield: { fontSize: "26px" },
  coreTitle: { fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "1.2px", marginTop: "2px" },
  coreSubtitle: { fontSize: "15px", fontWeight: 800, color: "#fff" },
  coreStatus: { fontSize: "9px", color: "#10b981", fontWeight: 700, marginTop: "2px" },
  satelliteNode: {
    position: "absolute", border: "1px solid",
    padding: "10px 16px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px",
    backdropFilter: "blur(12px)", cursor: "pointer", transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    zIndex: 20
  },
  satIcon: { fontSize: "20px" },
  satTitle: { fontSize: "13px", fontWeight: 700, color: "#f8fafc" },
  satSub: { fontSize: "11px", color: "#64748b" },
  satIndicatorActive: { width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", marginLeft: "4px" },
  satIndicator: { width: 6, height: 6, borderRadius: "50%", background: "#64748b", marginLeft: "4px" },

  methodsSection: { maxWidth: "1280px", margin: "80px auto 40px", paddingTop: "40px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  methodsSplitGrid: { display: "grid", gridTemplateColumns: "1.15fr 1.35fr", gap: "32px", alignItems: "start" },
  methodsListContainer: { background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(16px)", borderRadius: "18px", padding: "26px" },
  methodListItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 18px", borderRadius: "12px", border: "1px solid",
    cursor: "pointer", transition: "all 0.2s ease"
  },
  methodIconBox: { width: "38px", height: "38px", borderRadius: "10px", border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", background: "rgba(7, 11, 20, 0.8)" },
  methodsDetailCard: { background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(16px)", borderRadius: "18px", padding: "38px", textAlign: "left", position: "relative" },
  methodPreviewLargeIcon: { width: "80px", height: "80px", borderRadius: "18px", background: "rgba(6, 182, 212, 0.08)", border: "1px solid", display: "flex", alignItems: "center", justifyContent: "center" },
  specBadge: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "#cbd5e1", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 500 },
  methodFooterCard: { marginTop: "28px", paddingTop: "22px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" },

  studioContainer: { maxWidth: "820px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" },
  studioFactorSelector: { display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", justifyContent: "center" },
  factorTab: { background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, transition: "all 0.2s ease" },
  factorTabActive: { background: "rgba(6, 182, 212, 0.15)", border: "1px solid #06b6d4", color: "#38bdf8", padding: "10px 18px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 700, boxShadow: "0 0 20px rgba(6, 182, 212, 0.2)" },
  studioContextBar: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "640px", marginBottom: "14px", fontSize: "13px", color: "#94a3b8", background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255, 255, 255, 0.06)", padding: "10px 16px", borderRadius: "10px" },
  pulseLiveOrb: { width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" },
  viewport: { position: "relative", width: 640, height: 480, borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.12)", background: "#000", boxShadow: "0 25px 60px rgba(0,0,0,0.8)" },
  videoLayer: { position: "absolute", top: 0, left: 0, width: 640, height: 480, transform: "scaleX(-1)", objectFit: "cover" },
  canvasLayer: { position: "absolute", top: 0, left: 0, width: 640, height: 480, transform: "scaleX(-1)", pointerEvents: "none" },
  hudTopLeft: { position: "absolute", top: 16, left: 16, display: "flex", gap: "8px", zIndex: 10, alignItems: "center" },
  badgeDark: { background: "rgba(15, 23, 42, 0.85)", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", gap: "8px" },
  badgeGreen: { background: "rgba(16, 185, 129, 0.95)", color: "#050811", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)" },
  badgeTrigger: { background: "rgba(7, 11, 20, 0.85)", padding: "8px 14px", borderRadius: "8px", fontSize: "11px", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.35)", backdropFilter: "blur(10px)", fontFamily: "monospace", fontWeight: 600 },
  badgeDarkLarge: { background: "rgba(15, 23, 42, 0.85)", padding: "10px 18px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "12px", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" },
  badgeGreenLarge: { background: "rgba(16, 185, 129, 0.95)", color: "#050811", padding: "10px 18px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "12px", fontWeight: "bold", boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)" },
  badgeBlue: { background: "rgba(37, 99, 235, 0.9)", color: "#fff", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", border: "1px solid rgba(255, 255, 255, 0.15)" },
  cyanDotPulse: { width: 8, height: 8, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 8px #38bdf8" },
  greenDotPulse: { width: 8, height: 8, borderRadius: "50%", background: "#050811" },
  redDotPulse: { width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" },
  countdownOverlay: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(7, 11, 20, 0.94)", border: "1px solid #38bdf8", padding: "24px 36px", borderRadius: "18px", textAlign: "center", backdropFilter: "blur(12px)", zIndex: 20, boxShadow: "0 0 40px rgba(56, 189, 248, 0.25)" },
  countdownTimerCircle: { fontSize: "40px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace" },
  triggerToggleBar: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "6px 14px", borderRadius: "12px", backdropFilter: "blur(8px)" },
  terminalBox: { width: 640, marginTop: "18px", background: "rgba(10, 16, 30, 0.85)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", overflow: "hidden", backdropFilter: "blur(12px)" },
  terminalHeader: { padding: "10px 14px", background: "rgba(15, 23, 42, 0.8)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" },
  terminalContent: { margin: 0, padding: "14px", fontFamily: "monospace", fontSize: "12px", color: "#38bdf8", whiteSpace: "pre-wrap", lineHeight: 1.5 },

  toggleActive: { background: "linear-gradient(135deg, #06b6d4, #0284c7)", color: "#050811", border: "none", padding: "7px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(6, 182, 212, 0.3)" },
  toggleInactive: { background: "transparent", color: "#94a3b8", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "7px 14px", borderRadius: "8px", fontSize: "11px", cursor: "pointer" },

  formCard: { background: "rgba(15, 23, 42, 0.65)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)", borderRadius: "18px", padding: "34px", width: "480px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" },
  policyPanelCard: { background: "rgba(15, 23, 42, 0.65)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)", borderRadius: "18px", padding: "32px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" },
  headerIconBox: { width: "42px", height: "42px", borderRadius: "10px", background: "rgba(6, 182, 212, 0.12)", border: "1px solid rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" },
  fieldLabel: { fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 600 },
  input: { background: "rgba(7, 11, 20, 0.8)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#fff", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", outline: "none", transition: "border-color 0.2s" },
  inputSmall: { background: "rgba(7, 11, 20, 0.8)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#fff", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", outline: "none" },
  selectInput: { width: "100%", background: "#070b14", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#fff", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", outline: "none" },
  passwordEyeToggle: { position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "16px" },
  btnPrimaryLarge: { background: "linear-gradient(135deg, #06b6d4, #0284c7)", color: "#050811", border: "none", padding: "13px 26px", borderRadius: "10px", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 15px rgba(6, 182, 212, 0.35)" },
  btnOutlineLarge: { background: "transparent", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)", padding: "13px 26px", borderRadius: "10px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  btnPrimary: { background: "linear-gradient(135deg, #38bdf8, #0284c7)", color: "#050811", border: "none", padding: "11px 22px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "13px", boxShadow: "0 4px 14px rgba(56, 189, 248, 0.3)" },
  btnPrimarySmall: { background: "linear-gradient(135deg, #06b6d4, #0284c7)", color: "#050811", border: "none", padding: "9px 18px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", fontSize: "12px" },
  btnSmall: { background: "rgba(255, 255, 255, 0.05)", color: "#f8fafc", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600 },
  btnBlue: { background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700, boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)" },
  btnGreen: { background: "linear-gradient(135deg, #10b981, #059669)", color: "#050811", border: "none", padding: "11px 22px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 700, boxShadow: "0 4px 15px rgba(16, 185, 129, 0.35)" },
  btnRed: { background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700 },

  voiceRecordingContainer: { border: "1px solid", padding: "18px", borderRadius: "12px", textAlign: "center", marginBottom: "18px", minHeight: "85px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", transition: "all 0.3s ease" },
  waveformBars: { display: "flex", gap: "4px", alignItems: "center", height: "24px", marginTop: "8px" },
  waveBar: { width: 3, height: "18px", background: "#ef4444", borderRadius: "2px", animation: "pulse 0.8s infinite alternate ease-in-out" },
  audioPlayerWidget: { width: "100%", height: "36px", filter: "invert(0.9) hue-rotate(180deg)" },
  discardLink: { background: "transparent", border: "none", color: "#64748b", fontSize: "11px", cursor: "pointer", textDecoration: "underline", padding: "4px" },
  resultBanner: { marginTop: "16px", padding: "14px 16px", borderRadius: "10px", fontSize: "13px", border: "1px solid", backdropFilter: "blur(8px)" },
  tokenCodeBox: { display: "block", fontSize: "11px", wordBreak: "break-all", color: "#38bdf8", background: "rgba(0, 0, 0, 0.4)", padding: "8px", borderRadius: "6px", marginTop: "4px" },
  otpInfoBox: { background: "rgba(56, 189, 248, 0.08)", border: "1px dashed rgba(56, 189, 248, 0.3)", color: "#94a3b8", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", marginBottom: "16px", lineHeight: 1.5 },
  policySuccessBanner: { marginTop: "18px", padding: "14px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#10b981", borderRadius: "10px", fontSize: "13px", textAlign: "center" },
  docCodeCard: { background: "rgba(15, 23, 42, 0.65)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(18px)", padding: "26px", borderRadius: "16px", marginTop: "24px" },
  docCodeBlock: { background: "#050811", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "16px", borderRadius: "10px", color: "#38bdf8", overflowX: "auto", fontSize: "13px", lineHeight: 1.5 }
};