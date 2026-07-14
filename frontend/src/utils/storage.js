// Wrapper around localStorage.
// Centralizes all storage read/write operations, uses STORAGE_KEYS to avoid
// mistyped keys, handles JSON.parse/stringify automatically, and wraps everything
// in try/catch for safety.
import { STORAGE_KEYS } from '../constants/storageKeys'

// Reads a raw (string) value by key. Returns null if missing or on error.
function getRaw(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Writes a raw (string) value by key.
function setRaw(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore: localStorage may be unavailable (private mode, storage full...)
  }
}

// Removes a key.
function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

// --- Access token ---
function getToken() {
  return getRaw(STORAGE_KEYS.ACCESS_TOKEN) || getRaw('token')
}

function setToken(token) {
  if (token) setRaw(STORAGE_KEYS.ACCESS_TOKEN, token)
}

function removeToken() {
  remove(STORAGE_KEYS.ACCESS_TOKEN)
  remove('token')
}

// --- User (stored as JSON) ---
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

// Clears all login session data (used on logout or when the token expires).
function clearAuth() {
  removeToken()
  removeUser()
  remove('refreshToken')
  remove('currentUser')
  remove('role')
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
