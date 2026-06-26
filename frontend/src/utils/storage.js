// Lớp bọc (wrapper) quanh localStorage.
// Gom toàn bộ thao tác đọc/ghi storage về một chỗ, dùng STORAGE_KEYS để tránh gõ
// sai key, tự xử lý JSON.parse/stringify và bọc try/catch cho an toàn.
import { STORAGE_KEYS } from '../constants/storageKeys'

// Đọc giá trị thô (chuỗi) theo key. Trả về null nếu không có hoặc lỗi.
function getRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Ghi giá trị thô (chuỗi) theo key.
function setRaw(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Bỏ qua: localStorage có thể không khả dụng (ẩn danh, đầy bộ nhớ...)
  }
}

// Xóa một key.
function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Bỏ qua
  }
}

// --- Access token ---
function getToken() {
  return getRaw(STORAGE_KEYS.ACCESS_TOKEN)
}

function setToken(token) {
  if (token) setRaw(STORAGE_KEYS.ACCESS_TOKEN, token)
}

function removeToken() {
  remove(STORAGE_KEYS.ACCESS_TOKEN)
}

// --- User (lưu dưới dạng JSON) ---
function getUser() {
  const raw = getRaw(STORAGE_KEYS.USER)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function setUser(user) {
  if (user) setRaw(STORAGE_KEYS.USER, JSON.stringify(user))
}

function removeUser() {
  remove(STORAGE_KEYS.USER)
}

// Xóa sạch thông tin phiên đăng nhập (dùng khi logout hoặc token hết hạn).
function clearAuth() {
  removeToken()
  removeUser()
}

export const storage = {
  getToken,
  setToken,
  removeToken,
  getUser,
  setUser,
  removeUser,
  clearAuth,
}

export default storage
