import axiosClient from './axiosClient'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(
  /\/$/,
  '',
)
const WAITLIST_URL = `${API_BASE_URL}/waitlist`

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const waitlistApi = {
  join(payload) {
    return axiosClient.post(WAITLIST_URL, cleanPayload(payload))
  },

  getMine() {
    return axiosClient.get(`${WAITLIST_URL}/me`)
  },

  cancel(id) {
    return axiosClient.patch(`${WAITLIST_URL}/${id}/cancel`)
  },

  accept(id) {
    return axiosClient.patch(`${WAITLIST_URL}/${id}/accept`)
  },
}
