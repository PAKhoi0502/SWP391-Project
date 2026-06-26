import "../ui.css";

function StatusBadge({ status = "pending" }) {
  const normalizedStatus = String(status).toLowerCase();

  return (
    <span className={`ui-badge ui-badge-${normalizedStatus}`}>
      {status}
    </span>
  );
}

export default StatusBadge;