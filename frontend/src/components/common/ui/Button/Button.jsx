import "../ui.css";

function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  onClick,
  className = "",
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`}
    >
      {loading ? "Processing..." : children}
    </button>
  );
}

export default Button;