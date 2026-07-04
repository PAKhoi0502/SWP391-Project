import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

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
}

export default loyaltyApi
