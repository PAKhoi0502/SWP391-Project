import "../ui.css";

function Select({
  label,
  options = [],
  error,
  helperText,
  className = "",
  ...props
}) {
  return (
    <div className={`ui-field ${className}`}>
      {label && <label className="ui-label">{label}</label>}

      <select
        className={`ui-select ${error ? "ui-input-error" : ""}`}
        {...props}
      >
        {options.map((option) => {
          const value = typeof option === "object" ? option.value : option;
          const labelText = typeof option === "object" ? option.label : option;

          return (
            <option key={value} value={value}>
              {labelText}
            </option>
          );
        })}
      </select>

      {error && <span className="ui-error-text">{error}</span>}
      {!error && helperText && <span className="ui-helper-text">{helperText}</span>}
    </div>
  );
}

export default Select;