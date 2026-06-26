import "../ui.css";

function FilterBar({
  options = [],
  value,
  onChange,
}) {
  return (
    <div className="ui-filter-bar">
      {options.map((option) => {
        const optionValue = typeof option === "object" ? option.value : option;
        const label = typeof option === "object" ? option.label : option;

        return (
          <button
            key={optionValue}
            className={`ui-filter-item ${value === optionValue ? "active" : ""}`}
            onClick={() => onChange(optionValue)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterBar;