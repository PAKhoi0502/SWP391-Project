import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toPage = (response) => {
  const payload = unwrap(response)
  if (Array.isArray(payload)) return { content: payload, totalPages: 1, totalElements: payload.length }
  if (Array.isArray(payload?.content)) return payload
  return { content: [], totalPages: 1, totalElements: 0 }
}

export const washHistoryApi = {
  async getMyWashHistories({ page = 1, limit = 10 } = {}) {
    const response = await api.get('/wash-histories', { params: { page, limit } })
    return toPage(response)
  },

  async getMyWashHistoryDetail(id) {
    const response = await api.get(`/wash-histories/${id}`)
    return unwrap(response)
  },

  async getAdminWashHistories({ garageId, customerName, page = 1, limit = 10 } = {}) {
    const response = await api.get('/admin/wash-histories', {
      params: {
        ...(garageId ? { garageId } : {}),
        ...(customerName ? { customerName } : {}),
        page,
        limit,
      },
    })
    return toPage(response)
  },
}

export default washHistoryApi
