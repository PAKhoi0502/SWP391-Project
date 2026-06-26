import "../ui.css";

function Input({
  label,
  error,
  helperText,
  className = "",
  ...props
}) {
  return (
    <div className={`ui-field ${className}`}>
      {label && <label className="ui-label">{label}</label>}

      <input
        className={`ui-input ${error ? "ui-input-error" : ""}`}
        {...props}
      />

      {error && <span className="ui-error-text">{error}</span>}
      {!error && helperText && <span className="ui-helper-text">{helperText}</span>}
    </div>
  );
}

export default Input;