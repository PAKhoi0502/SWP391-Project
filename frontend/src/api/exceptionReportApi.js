import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toPage = (response) => {
  const payload = unwrap(response)
  if (Array.isArray(payload)) return { content: payload, totalPages: 1, totalElements: payload.length }
  if (Array.isArray(payload?.content)) return payload
  return { content: [], totalPages: 1, totalElements: 0 }
}

export const exceptionReportApi = {
  createReport: async (bookingId, data) =>
    unwrap(await api.post(`/bookings/${bookingId}/exception-reports`, data)),

  getMyReports: async () =>
    unwrap(await api.get('/customer/exception-reports')),

  getAdminReports: async ({ page = 1, limit = 20, status, category } = {}) =>
    toPage(await api.get('/admin/exception-reports', {
      params: {
        page,
        limit,
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(category && category !== 'ALL' ? { category } : {}),
      },
    })),

  getAdminReportDetail: async (id) =>
    unwrap(await api.get(`/admin/exception-reports/${id}`)),

  updateStatus: async (id, { status, note }) =>
    unwrap(await api.patch(`/admin/exception-reports/${id}/status`, { status, note })),
}

export default exceptionReportApi
