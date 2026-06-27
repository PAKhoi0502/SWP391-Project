import api from './api'

export const userService = {
  async getMe() {
    const res = await api.get('/users/me')
    return res.data
  },

  async updateMe(payload) {
    const res = await api.patch('/users/me', payload)
    return res.data
  },
}
