import api from '../services/api'

// ApiResponse<Page<NotificationResponse>>
// → response.data.data.content / .totalElements
const unwrapPage = (response) => {
  const inner = response?.data?.data ?? response?.data ?? response
  if (inner && Array.isArray(inner.content)) return inner
  if (Array.isArray(inner)) return { content: inner, totalElements: inner.length, totalPages: 1 }
  return { content: [], totalElements: 0, totalPages: 0 }
}

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const notificationApi = {
  async getNotifications({ page = 1, limit = 10, isRead } = {}) {
    const params = { page, limit }
    if (isRead !== undefined) params.isRead = isRead
    const response = await api.get('/notifications', { params })
    return unwrapPage(response)
  },

  async getUnreadNotifications({ page = 1, limit = 1 } = {}) {
    return notificationApi.getNotifications({ page, limit, isRead: false })
  },

  async getNotificationById(id) {
    const response = await api.get(`/notifications/${id}`)
    return unwrap(response)
  },

  async markNotificationRead(id) {
    const response = await api.patch(`/notifications/${id}/read`)
    return unwrap(response)
  },

  async markAllNotificationsRead() {
    const response = await api.patch('/notifications/read-all')
    return unwrap(response)
  },

  async deleteNotification(id) {
    await api.delete(`/notifications/${id}`)
  },
}

export default notificationApi
