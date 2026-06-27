import api from './api'

export const vehicleService = {
  async listOwn() {
    const res = await api.get('/api/vehicles')
    return res.data
  },

  async create(payload) {
    const res = await api.post('/api/vehicles', payload)
    return res.data
  },

  async update(id, payload) {
    const res = await api.patch(`/api/vehicles/${id}`, payload)
    return res.data
  },

  async setDefault(id) {
    const res = await api.patch(`/api/vehicles/${id}/default`)
    return res.data
  },

  async updateStatus(id, isActive) {
    const res = await api.patch(`/api/vehicles/${id}/status`, { isActive })
    return res.data
  },

  async adminList(params = {}) {
    const res = await api.get('/api/admin/vehicles', { params })
    return res.data
  },
}
