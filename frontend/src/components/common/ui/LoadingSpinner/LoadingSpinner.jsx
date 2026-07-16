import "../ui.css";

function LoadingSpinner({ text = "Loading data..." }) {
  return (
    <div className="ui-center-state">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div className="ui-spinner"></div>
      </div>
      <div className="ui-state-desc">{text}</div>
    </div>
  );
}

export default LoadingSpinner;