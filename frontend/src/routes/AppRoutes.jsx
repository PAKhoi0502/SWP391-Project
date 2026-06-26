// Khai báo toàn bộ tuyến đường (routes) của ứng dụng.
//
// Cấu trúc: MainLayout bọc các trang công khai; các route cần đăng nhập/giới hạn
// vai trò sẽ bọc thêm ProtectedRoute (ví dụ minh họa bên dưới, mở khi có trang).
import { Routes, Route } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import ForbiddenPage from '../pages/ForbiddenPage'

function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* --- Trang công khai --- */}
        <Route index element={<HomePage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* --- Trang cần bảo vệ theo vai trò (mở khi có trang tương ứng) ---
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        */}

        {/* 404 - phải đặt cuối cùng. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
