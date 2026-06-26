// Các vai trò người dùng trong hệ thống AutoWash Pro.
// Dùng hằng số thay vì gõ chuỗi trực tiếp để tránh sai chính tả.
export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
}

// Danh sách tất cả vai trò (tiện cho việc kiểm tra/validate).
export const ALL_ROLES = Object.values(ROLES)
