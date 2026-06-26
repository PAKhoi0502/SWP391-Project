import "../ui.css";

function LoadingSpinner({ text = "Đang tải dữ liệu..." }) {
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