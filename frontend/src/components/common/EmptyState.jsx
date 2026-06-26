// Trạng thái rỗng dùng chung.
// Hiển thị khi API trả về thành công nhưng không có dữ liệu nào để hiện.
function EmptyState({
  title = 'Chưa có dữ liệu',
  message = 'Hiện chưa có nội dung nào để hiển thị.',
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

      {/* action: phần tử tùy chọn (ví dụ nút "Tạo mới"). */}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}

export default EmptyState
