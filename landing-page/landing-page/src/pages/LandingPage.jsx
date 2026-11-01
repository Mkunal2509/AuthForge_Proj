import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import AuthenticationMethods from "../components/Authenticationmethods";
import SectionConnector from "../components/SectionConnector";

function LandingPage() {
  return (
    <div className="app">

      <Navbar />

      <main>

        <Hero />

        <SectionConnector label="AUTHENTICATION LAYER" />

        <AuthenticationMethods />

        <SectionConnector label="POLICY ENGINE" />

      </main>

    </div>
  );
}

export default LandingPage;