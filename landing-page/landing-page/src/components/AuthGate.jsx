import React, { useState } from "react";

const API = "http://localhost:8000/api/v1";

export default function AuthGate({ onAuthenticated }) {
  const [tab, setTab] = useState("password");
  const [userId, setUserId] = useState("developer_admin");
  const [password, setPassword] = useState("developer_secret");
  const [phone, setPhone] = useState("+10000000001");
  const [role, setRole] = useState("developer");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handlePasswordLogin = async () => {
    try {
      const res = await fetch(`${API}/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onAuthenticated(data);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleSendOTP = async () => {
    try {
      const res = await fetch(`${API}/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone }),
      });
      const data = await res.json();
      setOtpSent(true);
      setStatusMsg(`Code sent to ${phone}. Check backend terminal.`);
    } catch (err) {
      setStatusMsg("Failed to dispatch OTP.");
    }
  };

  const handleVerifyOTP = async () => {
    try {
      const res = await fetch(`${API}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, otp_code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      onAuthenticated(data);
    } catch (err) {
      setStatusMsg(`Verification Failed: ${err.message}`);
    }
  };

  const handleRegister = async () => {
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password, phone_number: phone, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setStatusMsg("Account created! Please sign in.");
      setTab("password");
    } catch (err) {
      setStatusMsg(`Registration Failed: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#070b14", color: "#f8fafc" }}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "32px", borderRadius: "12px", width: "380px" }}>
        <h2 style={{ color: "#38bdf8", marginTop: 0 }}>AuthForge Portal</h2>

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button onClick={() => { setTab("password"); setStatusMsg(""); }} style={tabBtn(tab === "password")}>Password</button>
          <button onClick={() => { setTab("otp"); setStatusMsg(""); }} style={tabBtn(tab === "otp")}>Phone OTP</button>
          <button onClick={() => { setTab("register"); setStatusMsg(""); }} style={tabBtn(tab === "register")}>Register</button>
        </div>

        {tab === "password" && (
          <div>
            <label style={labelStyle}>User ID</label>
            <input style={inputStyle} value={userId} onChange={(e) => setUserId(e.target.value)} />

            <label style={labelStyle}>Password</label>
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} />

            <button onClick={handlePasswordLogin} style={submitBtn("#3b82f6")}>Sign In</button>
          </div>
        )}

        {tab === "otp" && (
          <div>
            <label style={labelStyle}>Phone Number</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button onClick={handleSendOTP} style={{ ...submitBtn("#334155"), width: "auto", marginTop: 0 }}>Send</button>
            </div>

            {otpSent && (
              <div style={{ marginTop: "12px" }}>
                <label style={labelStyle}>6-Digit OTP</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input style={inputStyle} placeholder="123456" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                  <button onClick={handleVerifyOTP} style={{ ...submitBtn("#10b981"), width: "auto", marginTop: 0 }}>Verify</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "register" && (
          <div>
            <label style={labelStyle}>New User ID</label>
            <input style={inputStyle} value={userId} onChange={(e) => setUserId(e.target.value)} />

            <label style={labelStyle}>Password</label>
            <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} />

            <label style={labelStyle}>Phone Number</label>
            <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />

            <label style={labelStyle}>Account Role</label>
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="developer">Developer (Tenant Admin)</option>
              <option value="user">End User</option>
            </select>

            <button onClick={handleRegister} style={submitBtn("#10b981")}>Create Account</button>
          </div>
        )}

        {statusMsg && <p style={{ fontSize: "12px", color: "#38bdf8", marginTop: "16px" }}>{statusMsg}</p>}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "12px", color: "#94a3b8", marginTop: "10px" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#070b14", border: "1px solid #334155", color: "#fff", padding: "8px 10px", borderRadius: "6px", marginTop: "4px" };
const submitBtn = (bg) => ({ width: "100%", background: bg, color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, marginTop: "14px" });
const tabBtn = (active) => ({ flex: 1, padding: "8px", background: active ? "#1e293b" : "transparent", color: active ? "#38bdf8" : "#94a3b8", border: "1px solid #334155", borderRadius: "6px", cursor: "pointer", fontSize: "13px" });