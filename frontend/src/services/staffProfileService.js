import api from './api'

export const staffProfileService = {
  async list(params = {}) {
    const res = await api.get('/api/staff-profiles', { params })
    return res.data
  },

  async get(id) {
    const res = await api.get(`/api/staff-profiles/${id}`)
    return res.data
  },

  async getMe() {
    const res = await api.get('/api/staff-profiles/me')
    return res.data
  },

  async create(payload) {
    const res = await api.post('/api/staff-profiles', payload)
    return res.data
  },

  async update(id, payload) {
    const res = await api.patch(`/api/staff-profiles/${id}`, payload)
    return res.data
  },

  async updateStatus(id, isActive) {
    const res = await api.patch(`/api/staff-profiles/${id}/status`, { isActive })
    return res.data
  },
}
