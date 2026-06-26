// Axios client dùng chung cho toàn bộ ứng dụng.
//
// baseURL để trống ('') => mỗi API tự ghi full path ('/api/v1', '/health',
// '/auth/login'...). Lý do: backend hiện đặt prefix không đồng nhất giữa các
// controller, nên không gom được về một base chung. Ở môi trường dev, Vite proxy
// (xem vite.config.js) sẽ forward '/api', '/health', '/api-docs' về localhost:8080.
import axios from 'axios'
import { storage } from '../utils/storage'

const axiosClient = axios.create({
  // Cho phép cấu hình qua biến môi trường; mặc định '' = đường dẫn tương đối.
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// --- Request interceptor: tự đính kèm access token (nếu có) ---
axiosClient.interceptors.request.use(
  (config) => {
    const token = storage.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// --- Response interceptor: chuẩn hóa dữ liệu trả về và xử lý lỗi tập trung ---
//
// Backend bọc kết quả trong ApiResponse { success, message, data }. Interceptor
// này trả thẳng phần `data` của ApiResponse cho nơi gọi, để component không phải
// bóc tách nhiều tầng. Nếu response không theo định dạng đó thì trả nguyên body.
axiosClient.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'data' in body && 'success' in body) {
      return body.data
    }
    return body
  },
  (error) => {
    // Chuẩn hóa lỗi thành một object thống nhất để UI dễ hiển thị.
    const normalized = {
      status: error.response?.status ?? 0,
      message:
        error.response?.data?.message ||
        error.message ||
        'Đã có lỗi xảy ra, vui lòng thử lại.',
      data: error.response?.data ?? null,
    }

    // 401 => phiên đăng nhập hết hạn/không hợp lệ: dọn sạch thông tin auth.
    if (normalized.status === 401) {
      storage.clearAuth()
    }

    return Promise.reject(normalized)
  },
)

export default axiosClient
