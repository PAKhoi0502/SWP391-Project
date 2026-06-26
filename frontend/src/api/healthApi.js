// Các API kiểm tra "sức khỏe" / liên thông backend.
// Dùng để xác minh frontend gọi được server và proxy hoạt động.
import axiosClient from './axiosClient'

export const healthApi = {
  // GET /health -> backend trả ApiResponse { data: "UP" } (đã được interceptor bóc).
  checkHealth() {
    return axiosClient.get('/health')
  },

  // GET /api/v1 -> endpoint gốc của nhóm API version 1 (BaseController).
  getApiV1() {
    return axiosClient.get('/api/v1')
  },

  // GET /api-docs -> tài liệu OpenAPI (springdoc). Trả nguyên JSON, không qua ApiResponse.
  getApiDocs() {
    return axiosClient.get('/api-docs')
  },
}

export default healthApi
