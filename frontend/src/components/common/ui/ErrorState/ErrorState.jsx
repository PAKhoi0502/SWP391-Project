import "../ui.css";
import Button from "../Button/Button";

function ErrorState({
  title = "An error occurred",
  description = "Unable to load data. Please try again.",
  onRetry,
}) {
  return (
    <div className="ui-center-state">
      <div className="ui-state-icon">⚠️</div>
      <div className="ui-state-title">{title}</div>
      <div className="ui-state-desc">{description}</div>

      {onRetry && (
        <div style={{ marginTop: 18 }}>
          <Button onClick={onRetry}>Retry</Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;