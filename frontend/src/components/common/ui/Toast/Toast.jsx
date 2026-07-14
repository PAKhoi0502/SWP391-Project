import { useEffect } from "react";
import "../ui.css";

const toastIcon = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

function Toast({
  open,
  type = "success",
  title = "Notification",
  message,
  duration = 3000,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;

  return (
    <div className="ui-toast">
      <div className="ui-toast-icon">{toastIcon[type] || toastIcon.info}</div>

      <div>
        <div className="ui-toast-title">{title}</div>
        {message && <div className="ui-toast-message">{message}</div>}
      </div>

      <button className="ui-toast-close" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

export default Toast;