import api from './api'

export const bankAccountService = {
  async listOwn() {
    const res = await api.get('/api/bank-accounts')
    return res.data
  },

  async create(payload) {
    const res = await api.post('/api/bank-accounts', payload)
    return res.data
  },

  async update(id, payload) {
    const res = await api.patch(`/api/bank-accounts/${id}`, payload)
    return res.data
  },

  async setDefault(id) {
    const res = await api.patch(`/api/bank-accounts/${id}/default`)
    return res.data
  },

  async updateStatus(id, isActive) {
    const res = await api.patch(`/api/bank-accounts/${id}/status`, { isActive })
    return res.data
  },
}
