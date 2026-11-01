import {
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  ScanFace,
  Mic2,
  MailCheck,
  QrCode,
  PenTool,
  Sparkles,
} from "lucide-react";

const authMethods = [
  {
    name: "Password",
    type: "Credential",
    icon: LockKeyhole,
    position: "method-password",
  },
  {
    name: "Face",
    type: "Biometric",
    icon: ScanFace,
    position: "method-face",
  },
  {
    name: "Voice",
    type: "Biometric",
    icon: Mic2,
    position: "method-voice",
  },
  {
    name: "Email OTP",
    type: "Multi-Factor",
    icon: MailCheck,
    position: "method-otp",
  },
  {
    name: "QR Code",
    type: "Passwordless",
    icon: QrCode,
    position: "method-qr",
  },
  {
    name: "Air Signature",
    type: "Behavioral",
    icon: PenTool,
    position: "method-air",
  },
];

function Hero() {
  return (
    <section className="hero">

      {/* Background */}
      <div className="hero-grid"></div>

      <div className="hero-glow hero-glow-one"></div>
      <div className="hero-glow hero-glow-two"></div>

      <div className="hero-container">

        {/* =========================
            LEFT CONTENT
        ========================= */}

        <div className="hero-content">

          <div className="hero-badge">
            <span className="status-dot"></span>

            AUTHENTICATION-AS-A-SERVICE
          </div>

          <h1>
            Secure Authentication.
            <span>Built for Every Application.</span>
          </h1>

          <p className="hero-description">
            AuthForge is a modular authentication platform that gives
            developers the freedom to combine multiple authentication
            methods and create secure experiences for every application.
          </p>

          <div className="hero-buttons">

            <button className="primary-btn">
              Start Building
              <ArrowRight size={17} />
            </button>

            <button className="secondary-btn">
              Explore Authentication
            </button>

          </div>

          <div className="hero-highlights">

            <div>
              <ShieldCheck size={16} />
              <span>Centralized Security</span>
            </div>

            <div>
              <Sparkles size={16} />
              <span>Modular by Design</span>
            </div>

          </div>

        </div>


        {/* =========================
            RIGHT VISUAL
        ========================= */}

        <div className="hero-network">

          <div className="network-glow"></div>

          {/* Connection SVG */}

          <svg
            className="network-lines"
            viewBox="0 0 600 600"
            aria-hidden="true"
          >
            <defs>

              <linearGradient
                id="lineGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor="rgba(0,242,254,0)"
                />

                <stop
                  offset="50%"
                  stopColor="rgba(0,242,254,0.55)"
                />

                <stop
                  offset="100%"
                  stopColor="rgba(0,242,254,0)"
                />
              </linearGradient>

            </defs>

            {/* Horizontal */}
            <path
              d="M 65 300 L 535 300"
              className="network-path"
            />

            {/* Vertical */}
            <path
              d="M 300 65 L 300 535"
              className="network-path"
            />

            {/* Diagonal */}
            <path
              d="M 100 100 L 500 500"
              className="network-path"
            />

            <path
              d="M 500 100 L 100 500"
              className="network-path"
            />

            {/* Inner ring */}
            <circle
              cx="300"
              cy="300"
              r="145"
              className="network-ring"
            />

            <circle
              cx="300"
              cy="300"
              r="195"
              className="network-ring outer"
            />

          </svg>


          {/* =========================
              CENTRAL CORE
          ========================= */}

          <div className="auth-core">

            <div className="core-orbit orbit-one"></div>
            <div className="core-orbit orbit-two"></div>

            <div className="core-inner">

              <div className="core-icon">
                <ShieldCheck size={31} />
              </div>

              <span className="core-small">
                AUTHFORGE
              </span>

              <strong>
                CORE
              </strong>

              <div className="core-status">
                <span></span>
                READY
              </div>

            </div>

          </div>


          {/* =========================
              AUTH METHOD CARDS
          ========================= */}

          {authMethods.map((method) => {

            const Icon = method.icon;

            return (
              <div
                key={method.name}
                className={`network-method ${method.position}`}
              >

                <div className="network-method-icon">
                  <Icon size={17} />
                </div>

                <div className="network-method-info">

                  <strong>
                    {method.name}
                  </strong>

                  <span>
                    {method.type}
                  </span>

                </div>

                <div className="method-status"></div>

              </div>
            );
          })}


          {/* Decorative coordinates */}

          <div className="network-label network-label-top">
            AUTHENTICATION
          </div>

          <div className="network-label network-label-bottom">
            MODULAR SECURITY SYSTEM
          </div>

          <div className="network-coordinate coordinate-one">
            18.042° / 72.856°
          </div>

          <div className="network-coordinate coordinate-two">
            AF // 06
          </div>

        </div>

      </div>


      {/* =========================
          BOTTOM STRIP
      ========================= */}
<div
  className="hero"
  id="home"
></div>

    </section>
  );
}

export default Hero;
