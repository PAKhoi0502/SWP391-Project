// Route được bảo vệ theo trạng thái đăng nhập và vai trò.
//
// - Chưa đăng nhập (không có token)  -> chuyển về /login.
// - Đã đăng nhập nhưng sai vai trò   -> chuyển về /forbidden (403).
// - Hợp lệ                            -> render route con qua <Outlet />.
//
// Cách dùng: bọc nhóm route cần bảo vệ và (tùy chọn) truyền danh sách vai trò:
//   <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}> ... </Route>
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { storage } from '../utils/storage'

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation()
  const token = storage.getToken()
  const user = storage.getUser()

  // Chưa đăng nhập -> về trang đăng nhập, nhớ lại trang đang muốn vào.
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Có giới hạn vai trò và vai trò hiện tại không nằm trong danh sách cho phép.
  if (allowedRoles && allowedRoles.length > 0) {
    const role = user?.role
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/forbidden" replace />
    }
  }

  return <Outlet />
}

export default ProtectedRoute
