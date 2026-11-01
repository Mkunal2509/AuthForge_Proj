import { ShieldCheck, ArrowRight } from "lucide-react";

function Navbar() {
  return (
    <header className="navbar">
      <div className="nav-container">

        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={21} />
          </div>

          <span className="brand-name">
            AuthForge
          </span>
        </div>
        <nav className="nav-links">

  <a href="#home">
    Home
  </a>

  <a href="#authentication">
    Authentication
  </a>

  <a href="#policy">
    Policy Engine
  </a>

  <a href="#developers">
    Developers
  </a>

</nav>
        <div className="nav-actions">

          <button className="login-btn">
            Log in
          </button>

          <button className="nav-cta">
            Get Started
            <ArrowRight size={16} />
          </button>

        </div>

      </div>
    </header>
  );
}

export default Navbar;