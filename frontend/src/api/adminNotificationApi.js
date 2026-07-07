import api from '../services/api'

const adminNotificationApi = {
  async sendTestEmail(email) {
    const response = await api.post('/admin/notifications/test-email', { email })
    return response?.data?.data ?? response?.data ?? response
  },
}

export default adminNotificationApi
