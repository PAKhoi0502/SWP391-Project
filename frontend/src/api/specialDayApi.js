import api from '../services/api'

const unwrap = (response) => {
  const envelope = response?.data
  if (envelope != null && typeof envelope === 'object' && 'data' in envelope) return envelope.data
  return envelope ?? response
}

export const specialDayApi = {
  async getAll() {
    const response = await api.get('/admin/special-days')
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  async create(payload) {
    const response = await api.post('/admin/special-days', payload)
    return unwrap(response)
  },

  async update(id, payload) {
    const response = await api.patch(`/admin/special-days/${id}`, payload)
    return unwrap(response)
  },

  async check(date) {
    const response = await api.get('/special-days/check', { params: { date } })
    return unwrap(response)
  },
}

export default specialDayApi
