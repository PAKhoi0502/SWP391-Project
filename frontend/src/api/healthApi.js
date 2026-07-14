// APIs for checking backend "health" / connectivity.
// Used to verify the frontend can reach the server and the proxy is working.
import axiosClient from './axiosClient'

export const healthApi = {
  // GET /health -> backend returns ApiResponse { data: "UP" } (already unwrapped by the interceptor).
  checkHealth() {
    return axiosClient.get('/health')
  },

  // GET /api/v1 -> root endpoint of the API version 1 group (BaseController).
  getApiV1() {
    return axiosClient.get('/api/v1')
  },

  // GET /api-docs -> OpenAPI documentation (springdoc). Returns raw JSON, not wrapped in ApiResponse.
  getApiDocs() {
    return axiosClient.get('/api-docs')
  },
}

export default healthApi
