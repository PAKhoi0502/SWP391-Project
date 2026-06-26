// Khai báo toàn bộ tuyến đường (routes) của ứng dụng.
import { Routes, Route } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import HomePage from "../pages/HomePage";
import NotFoundPage from "../pages/NotFoundPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Trang công khai */}
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forbidden" element={<ForbiddenPage />} />

        {/* 404 - phải đặt cuối cùng */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;