import "../ui.css";
import Button from "../Button/Button";

function ErrorState({
  title = "Đã xảy ra lỗi",
  description = "Không thể tải dữ liệu. Vui lòng thử lại.",
  onRetry,
}) {
  return (
    <div className="ui-center-state">
      <div className="ui-state-icon">⚠️</div>
      <div className="ui-state-title">{title}</div>
      <div className="ui-state-desc">{description}</div>

      {onRetry && (
        <div style={{ marginTop: 18 }}>
          <Button onClick={onRetry}>Thử lại</Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;