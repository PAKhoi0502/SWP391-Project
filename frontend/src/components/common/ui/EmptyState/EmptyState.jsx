import "../ui.css";

function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ được hiển thị tại đây khi có thông tin.",
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