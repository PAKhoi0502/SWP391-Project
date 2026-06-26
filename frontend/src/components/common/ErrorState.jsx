// Trạng thái lỗi dùng chung.
// Hiển thị khi gọi API thất bại; có nút "Thử lại" nếu truyền onRetry.
function ErrorState({
  title = 'Đã có lỗi xảy ra',
  message = 'Không thể tải dữ liệu. Vui lòng thử lại.',
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
          Thử lại
        </button>
      )}
    </div>
  )
}

export default ErrorState
