// Shared axios client used across the entire application.
//
// baseURL is left empty ('') => each API writes its own full path ('/api/v1', '/health',
// '/auth/login'...). Reason: the backend currently uses inconsistent prefixes across
// controllers, so they can't be consolidated under one common base. In the dev environment,
// the Vite proxy (see vite.config.js) forwards '/api', '/health', '/api-docs' to localhost:8080.
import axios from 'axios'
import { storage } from '../utils/storage'

const axiosClient = axios.create({
  // Configurable via environment variable; defaults to '' = relative path.
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// --- Request interceptor: automatically attaches the access token (if present) ---
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

// --- Response interceptor: normalizes the returned data and handles errors centrally ---
//
// The backend wraps results in an ApiResponse { success, message, data }. This interceptor
// returns the ApiResponse's `data` field directly to the caller, so components don't have to
// unwrap multiple layers. If the response doesn't follow that format, the raw body is returned.
axiosClient.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'data' in body && 'success' in body) {
      return body.data
    }
    return body
  },
  (error) => {
    // Normalize the error into a consistent object so the UI can display it easily.
    const normalized = {
      status: error.response?.status ?? 0,
      message:
        error.response?.data?.message ||
        error.message ||
        'An error occurred, please try again.',
      data: error.response?.data ?? null,
    }

    // 401 => login session expired/invalid: clear auth information.
    if (normalized.status === 401) {
      storage.clearAuth()
    }

    return Promise.reject(normalized)
  },
)

export default axiosClient
