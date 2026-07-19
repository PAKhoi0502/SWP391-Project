import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toPage = (response) => {
  const payload = unwrap(response)
  if (Array.isArray(payload)) return { content: payload, totalPages: 1, totalElements: payload.length }
  if (Array.isArray(payload?.content)) return payload
  return { content: [], totalPages: 1, totalElements: 0 }
}

export const reviewApi = {
  checkEligibility: async (bookingId) =>
    unwrap(await api.get(`/bookings/${bookingId}/review-eligibility`)),

  createReview: async (bookingId, data) =>
    unwrap(await api.post(`/bookings/${bookingId}/reviews`, data)),

  getMyReview: async (bookingId) =>
    unwrap(await api.get(`/bookings/${bookingId}/reviews`)),

  getAdminReviews: async ({ page = 1, limit = 20 } = {}) =>
    toPage(await api.get('/admin/reviews', { params: { page, limit } })),

  getAdminStats: async () =>
    unwrap(await api.get('/admin/reviews/stats')),

  getPublicReviews: async ({ page = 1, limit = 10 } = {}) =>
    toPage(await api.get('/public/reviews', { params: { page, limit } })),

  getPublicStats: async () =>
    unwrap(await api.get('/public/reviews/stats')),
}

export default reviewApi
