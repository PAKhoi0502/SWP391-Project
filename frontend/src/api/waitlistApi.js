import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toPage = (response) => {
  const payload = unwrap(response)
  if (Array.isArray(payload)) return { content: payload, totalPages: 1, totalElements: payload.length }
  if (Array.isArray(payload?.content)) return payload
  return { content: [], totalPages: 1, totalElements: 0 }
}

export const waitlistApi = {
  // ===== Customer =====
  async join({ garageId, vehicleId, servicePackageId, desiredStartTime, reason }) {
    const response = await api.post('/waitlist', {
      garageId: Number(garageId),
      vehicleId: Number(vehicleId),
      servicePackageId: Number(servicePackageId),
      desiredStartTime,
      reason,
    })
    return unwrap(response)
  },

  async getMine({ page = 1, limit = 20 } = {}) {
    const response = await api.get('/waitlist/me', { params: { page, limit } })
    return toPage(response)
  },

  async getDetail(id) {
    const response = await api.get(`/waitlist/${id}`)
    return unwrap(response)
  },

  async cancel(id) {
    const response = await api.patch(`/waitlist/${id}/cancel`)
    return unwrap(response)
  },

  async accept(id) {
    const response = await api.patch(`/waitlist/${id}/accept`)
    return unwrap(response)
  },

  // ===== Admin / Staff =====
  async getAdminWaitlists({ garageId, status, page = 1, limit = 10 } = {}) {
    const response = await api.get('/admin/waitlist', {
      params: {
        ...(garageId ? { garageId } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
        page,
        limit,
      },
    })
    return toPage(response)
  },

  async offerWaitlist(id) {
    const response = await api.patch(`/admin/waitlist/${id}/offer`)
    return unwrap(response)
  },

  async expireWaitlist(id) {
    const response = await api.patch(`/admin/waitlist/${id}/expire`)
    return unwrap(response)
  },
}

export default waitlistApi
