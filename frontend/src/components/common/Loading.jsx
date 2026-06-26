// Trạng thái đang tải (loading) dùng chung.
// Hiển thị khi đang chờ dữ liệu từ API.
function Loading({ message = 'Đang tải...' }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          border: '3px solid #d0d0d0',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'awp-spin 0.8s linear infinite',
        }}
      />
      <p style={{ margin: 0, color: '#555' }}>{message}</p>

      {/* Keyframe cho hiệu ứng xoay; nhúng tại chỗ để component tự chứa. */}
      <style>{`@keyframes awp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default Loading
