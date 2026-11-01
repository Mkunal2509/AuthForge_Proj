function SectionConnector({ label }) {
  return (
    <div className="section-connector">

      <div className="connector-line"></div>

      <div className="connector-node">
        <span></span>
      </div>

      {label && (
        <span className="connector-label">
          {label}
        </span>
      )}

      <div className="connector-line"></div>

    </div>
  );
}

export default SectionConnector;