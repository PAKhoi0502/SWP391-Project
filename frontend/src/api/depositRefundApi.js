import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toArray = (response) => {
  const payload = unwrap(response)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data

  return []
}

export const depositRefundApi = {
  async getRefundEligibility(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/refund-eligibility`)
    return unwrap(response)
  },

  async createDepositRefund(bookingId, bankAccountId) {
    const response = await api.post(`/bookings/${bookingId}/deposit-refunds`, { bankAccountId })
    return unwrap(response)
  },

  async getMyDepositRefunds() {
    const response = await api.get('/me/deposit-refunds')
    return toArray(response)
  },

  async getMyDepositRefundById(refundId) {
    const response = await api.get(`/me/deposit-refunds/${refundId}`)
    return unwrap(response)
  },

  async getAdminDepositRefunds({ page = 1, limit = 10, status } = {}) {
    const response = await api.get('/admin/deposit-refunds', {
      params: {
        page,
        limit,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
    })
    return unwrap(response)
  },

  async getAdminDepositRefundById(refundId) {
    const response = await api.get(`/admin/deposit-refunds/${refundId}`)
    return unwrap(response)
  },

  async approveDepositRefund(refundId) {
    const response = await api.patch(`/admin/deposit-refunds/${refundId}/approve`)
    return unwrap(response)
  },

  async rejectDepositRefund(refundId, reason) {
    const response = await api.patch(`/admin/deposit-refunds/${refundId}/reject`, { reason })
    return unwrap(response)
  },

  async executeDepositRefund(refundId, { success = true, note, transactionReference } = {}) {
    const response = await api.post(`/admin/deposit-refunds/${refundId}/execute`, {
      success,
      note,
      transactionReference,
    })
    return unwrap(response)
  },
}
