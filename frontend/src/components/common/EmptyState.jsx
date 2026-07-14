// Shared empty state.
// Displayed when the API call succeeds but there is no data to show.
function EmptyState({
  title = 'No data yet',
  message = 'There is no content to display yet.',
  action,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 40 }}>
        📭
      </span>
      <h3 style={{ margin: 0, color: '#374151' }}>{title}</h3>
      <p style={{ margin: 0, color: '#777' }}>{message}</p>

      {/* action: optional element (e.g. a "Create new" button). */}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export default EmptyState
