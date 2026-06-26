import "../ui.css";

function RoleBadge({ role = "customer" }) {
  const normalizedRole = String(role).toLowerCase();

  return (
    <span className={`ui-badge ui-role-${normalizedRole}`}>
      {role}
    </span>
  );
}

export default RoleBadge;