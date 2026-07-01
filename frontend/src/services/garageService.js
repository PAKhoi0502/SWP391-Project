import api from './api'

export const garageService = {
  async list(params = {}) {
    const res = await api.get('/api/garages', { params })
    return res.data
  },

  async getById(id) {
    const res = await api.get(`/api/garages/${id}`)
    return res.data
  },
}
