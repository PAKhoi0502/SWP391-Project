// Shared error state.
// Displayed when an API call fails; shows a "Retry" button if onRetry is provided.
function ErrorState({
  title = 'An error occurred',
  message = 'Unable to load data. Please try again.',
  onRetry,
}) {
  return (
    <div
      role="alert"
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
        ⚠️
      </span>
      <h3 style={{ margin: 0, color: '#b91c1c' }}>{title}</h3>
      <p style={{ margin: 0, color: '#555' }}>{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            background: '#3b82f6',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}

export default ErrorState
