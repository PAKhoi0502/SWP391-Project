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

  async getBookingManagement(params) {
    const q = new URLSearchParams()
    if (params.page)              q.set('page', params.page)
    if (params.limit)             q.set('limit', params.limit)
    if (params.tab)               q.set('tab', params.tab)
    if (params.garageId)          q.set('garageId', params.garageId)
    if (params.servicePackageId)  q.set('service_package_id', params.servicePackageId)
    if (params.status)            q.set('status', params.status)
    if (params.date)              q.set('date', params.date)
    const response = await api.get(`/admin/analytics/booking-management?${q}`)
    return unwrap(response)
  },

  async getBookingCalendar({ year, month, garageId, servicePackageId } = {}) {
    const q = new URLSearchParams({ year, month })
    if (garageId) q.set('garageId', garageId)
    if (servicePackageId) q.set('service_package_id', servicePackageId)
    const response = await api.get(`/admin/analytics/booking-calendar?${q}`)
    return unwrap(response) // returns array of {date, totalBookings, byStatus}
  },

  async getServicePackages() {
    const response = await api.get('/service-packages')
    return unwrap(response)
  },
}

export default adminAnalyticsApi
