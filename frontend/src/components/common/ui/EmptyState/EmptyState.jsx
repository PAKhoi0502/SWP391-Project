import "../ui.css";

function EmptyState({
  title = "No data yet",
  description = "Data will be displayed here once available.",
  icon = "🫧",
}) {
  return (
    <div className="ui-center-state">
      <div className="ui-state-icon">{icon}</div>
      <div className="ui-state-title">{title}</div>
      <div className="ui-state-desc">{description}</div>
    </div>
  );
}

export default EmptyState;