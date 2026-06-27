import api from './api'

export const userService = {
  async getUsers() {
    const res = await api.get('/users')
    return res.data
  },

  async getUser(id) {
    const res = await api.get(`/users/${id}`)
    return res.data
  },

  async updateStatus(id, isActive) {
    const res = await api.patch(`/users/${id}/status`, { isActive })
    return res.data
  },

  async updateRole(id, role) {
    const res = await api.patch(`/users/${id}/role`, { role })
    return res.data
  },
}
