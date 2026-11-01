import { useState } from "react";

import {
  LockKeyhole,
  ScanFace,
  Mic2,
  MailCheck,
  QrCode,
  PenTool,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

const methods = [
  {
    id: "01",
    name: "Password",
    type: "Credential",
    description:
      "Reliable credential-based authentication for secure application access.",
    icon: LockKeyhole,
    color: "cyan",
  },
  {
    id: "02",
    name: "Face",
    type: "Biometric",
    description:
      "AI-powered facial verification for fast and secure identity authentication.",
    icon: ScanFace,
    color: "cyan",
  },
  {
    id: "03",
    name: "Voice",
    type: "Biometric",
    description:
      "Voice-based identity verification for an additional biometric security layer.",
    icon: Mic2,
    color: "cyan",
  },
  {
    id: "04",
    name: "Email OTP",
    type: "Multi-Factor",
    description:
      "One-time password verification that adds another layer of account security.",
    icon: MailCheck,
    color: "cyan",
  },
  {
    id: "05",
    name: "QR Code",
    type: "Passwordless",
    description:
      "Fast QR-based authentication for connected devices and passwordless access.",
    icon: QrCode,
    color: "cyan",
  },
  {
    id: "06",
    name: "Air Signature",
    type: "Behavioral",
    description:
      "Gesture-based behavioral biometric authentication using unique air signatures.",
    icon: PenTool,
    color: "cyan",
  },
];

function AuthenticationMethods() {
  const [activeMethod, setActiveMethod] = useState(methods[0]);

  const ActiveIcon = activeMethod.icon;

  return (
    <section
      className="auth-methods-section"
      id="authentication"
    >
      <div className="auth-methods-container">

        {/* =========================
            SECTION INTRO
        ========================= */}

        <div className="auth-methods-heading">

          

          <h2>
            One Platform.
            <span>Multiple Authentication Methods.</span>
          </h2>

          <p>
            Choose the authentication methods your application needs.
            AuthForge brings credential, biometric, multi-factor,
            passwordless and behavioral authentication into one
            modular platform.
          </p>

        </div>


        {/* =========================
            MAIN INTERACTIVE AREA
        ========================= */}

        <div className="methods-showcase">

          {/* LEFT */}

          <div className="methods-sidebar">

            <div className="methods-sidebar-top">

              <div>
                <span>AUTHFORGE MODULES</span>

                <strong>
                  Authentication Methods
                </strong>
              </div>

              <div className="methods-total">
                06
              </div>

            </div>


            <div className="methods-list">

              {methods.map((method) => {

                const Icon = method.icon;

                const isActive =
                  activeMethod.id === method.id;

                return (
                  <button
                    key={method.id}
                    className={`method-row ${
                      isActive ? "method-row-active" : ""
                    }`}
                    onClick={() => setActiveMethod(method)}
                  >

                    <div className="method-row-number">
                      {method.id}
                    </div>

                    <div className="method-row-icon">
                      <Icon size={17} />
                    </div>

                    <div className="method-row-info">

                      <strong>
                        {method.name}
                      </strong>

                      <span>
                        {method.type}
                      </span>

                    </div>

                    <ArrowUpRight
                      size={15}
                      className="method-row-arrow"
                    />

                  </button>
                );
              })}

            </div>

          </div>


          {/* RIGHT PREVIEW */}

          <div className="method-detail">

            <div className="method-detail-grid"></div>

            <div className="method-detail-glow"></div>


            <div className="method-detail-content">

              {/* Top */}

              <div className="detail-top">

                <span>
                  AUTHFORGE / PLUGIN
                </span>

                <div className="detail-active">
                  <span></span>
                  ACTIVE
                </div>

              </div>


              {/* Main icon */}

              <div className="detail-icon-wrapper">

                <div className="detail-icon-ring"></div>

                <div className="detail-icon">
                  <ActiveIcon size={34} />
                </div>

              </div>


              {/* Method information */}

              <div className="detail-info">

                <span className="detail-id">
                  AUTH-{activeMethod.id}
                </span>

                <h3>
                  {activeMethod.name}
                </h3>

                <div className="detail-type">
                  {activeMethod.type}
                </div>

                <p>
                  {activeMethod.description}
                </p>

              </div>


              {/* Capabilities */}

              <div className="detail-divider"></div>

              <div className="detail-capabilities">

                <div>
                  <ShieldCheck size={15} />

                  <span>
                    Secure verification
                  </span>
                </div>

                <div>
                  <Zap size={15} />

                  <span>
                    Modular integration
                  </span>
                </div>

              </div>


              {/* Plugin status */}

              <div className="plugin-status-panel">

                <div className="plugin-status-left">

                  <div className="status-check">
                    <ShieldCheck size={16} />
                  </div>

                  <div>
                    <span>
                      PLUGIN STATUS
                    </span>

                    <strong>
                      Ready for policy configuration
                    </strong>
                  </div>

                </div>

                <div className="status-indicator">
                  <span></span>
                </div>

              </div>

            </div>

          </div>

        </div>


        {/* =========================
            BOTTOM MESSAGE
        ========================= */}

        <div className="methods-bottom">

          <div className="methods-bottom-line"></div>

          <span>
            SELECT • CONFIGURE • COMBINE
          </span>

          <div className="methods-bottom-line"></div>

        </div>

      </div>
    </section>
  );
}

export default AuthenticationMethods;