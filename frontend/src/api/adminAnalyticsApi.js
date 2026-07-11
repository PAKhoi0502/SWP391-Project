import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const buildParams = ({ from, to, garageId } = {}) => {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  if (garageId) params.garage_id = garageId
  return params
}

const adminAnalyticsApi = {
  async getOverview(filters) {
    const response = await api.get('/admin/analytics/overview', { params: buildParams(filters) })
    return unwrap(response)
  },

  async getBookingStatistics(filters) {
    const response = await api.get('/admin/analytics/bookings', { params: buildParams(filters) })
    return unwrap(response)
  },

  async getRevenueStatistics(filters) {
    const response = await api.get('/admin/analytics/revenue', { params: buildParams(filters) })
    return unwrap(response)
  },

  async getLoyaltyStatistics(filters) {
    const response = await api.get('/admin/analytics/loyalty', { params: buildParams(filters) })
    return unwrap(response)
  },

  async getPromotionPerformance(filters) {
    const response = await api.get('/admin/analytics/promotions', { params: buildParams(filters) })
    return unwrap(response)
  },

  async getWashBayPerformance(filters) {
    const response = await api.get('/admin/analytics/wash-bays', { params: buildParams(filters) })
    return unwrap(response)
  },
}

export default adminAnalyticsApi
