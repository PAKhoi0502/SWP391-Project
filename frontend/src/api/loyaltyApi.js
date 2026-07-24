import api from '../services/api'

const unwrap = (response) => {
  const envelope = response?.data
  if (envelope != null && typeof envelope === 'object' && 'data' in envelope) return envelope.data
  return envelope ?? response
}

export const loyaltyApi = {
  async getMyLoyalty() {
    const response = await api.get('/loyalty/me')
    return unwrap(response)
  },

  async getTierRules() {
    const response = await api.get('/loyalty/tier-rules')
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  async getMyTransactions({ type, page = 1, limit = 10 } = {}) {
    const response = await api.get('/loyalty/me/transactions', {
      params: {
        ...(type ? { type } : {}),
        page,
        limit,
      },
    })
    return unwrap(response)
  },

  async redeemPreview({ servicePackageId, points, subtotalAfterPromotion }) {
    const response = await api.post('/loyalty/redeem-preview', {
      servicePackageId,
      points,
      ...(subtotalAfterPromotion != null ? { subtotalAfterPromotion } : {}),
    })
    return unwrap(response)
  },

  async getAdminTierRules() {
    const response = await api.get('/loyalty/admin/tier-rules')
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  async createTierRule(payload) {
    const response = await api.post('/loyalty/admin/tier-rules', payload)
    return unwrap(response)
  },

  async updateTierRule(id, payload) {
    const response = await api.patch(`/loyalty/admin/tier-rules/${id}`, payload)
    return unwrap(response)
  },

  async adjustPoints({ customerId, points, type = 'ADJUST', reason }) {
    const response = await api.post('/loyalty/admin/adjust-points', { customerId, points, type, reason })
    return unwrap(response)
  },

  async getAdminCustomerCreditLots({ customerId, page = 1, limit = 20, status, expiringWithinDays, type } = {}) {
    const response = await api.get(`/loyalty/admin/customers/${customerId}/credit-lots`, {
      params: {
        page,
        limit,
        ...(status ? { status } : {}),
        ...(expiringWithinDays != null ? { expiringWithinDays } : {}),
        ...(type ? { type } : {}),
      },
    })
    return unwrap(response)
  },

  async getAdminCustomerTransactions({ customerId, type, page = 1, limit = 20 } = {}) {
    const response = await api.get(`/loyalty/admin/customers/${customerId}/transactions`, {
      params: {
        page,
        limit,
        ...(type ? { type } : {}),
      },
    })
    return unwrap(response)
  },

  async extendLotExpiry({ lotId, newExpiredAt, reason }) {
    const response = await api.patch(`/loyalty/admin/credit-lots/${lotId}/expiry`, { newExpiredAt, reason })
    return unwrap(response)
  },

  async runExpiryForCustomer(customerId) {
    const response = await api.post(`/loyalty/admin/customers/${customerId}/run-expiry`)
    return unwrap(response)
  },

  async getLatestExpiryRun() {
    const response = await api.get('/loyalty/admin/expiry-runs/latest')
    return unwrap(response)
  },

  async getExpiryRunHistory({ page = 1, limit = 10, triggerType } = {}) {
    const response = await api.get('/loyalty/admin/expiry-runs', {
      params: { page, limit, ...(triggerType ? { triggerType } : {}) },
    })
    return unwrap(response)
  },

  async getAdminCustomerOverview(customerId) {
    const response = await api.get(`/loyalty/admin/customers/${customerId}/overview`)
    return unwrap(response)
  },

  async getLeaderboard({ period = 'MONTHLY', page = 1, limit = 20 } = {}) {
    const response = await api.get('/loyalty/leaderboard', { params: { period, page, limit } })
    return unwrap(response)
  },
}

export default loyaltyApi
