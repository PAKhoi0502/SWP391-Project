import "../ui.css";

function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  className = "",
}) {
  return (
    <input
      className={`ui-search ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default SearchBox;