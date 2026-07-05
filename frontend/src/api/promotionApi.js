import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const promotionApi = {
  // ── Customer ──────────────────────────────────────────────
  async getActivePromotions() {
    const response = await api.get('/promotions')
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  async getPromotionById(id) {
    const response = await api.get(`/promotions/${id}`)
    return unwrap(response)
  },

  async getEligiblePromotions({ servicePackageId, orderAmount }) {
    const response = await api.get('/promotions/eligible', {
      params: { servicePackageId, orderAmount },
    })
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  async validatePromotion({ promotionCode, servicePackageId, orderAmount }) {
    const response = await api.post('/promotions/validate', {
      promotionCode,
      servicePackageId,
      orderAmount,
    })
    return unwrap(response)
  },

  // ── Admin ─────────────────────────────────────────────────
  // NOTE: GET /promotions returns ACTIVE promotions only (no admin-all endpoint).
  // Admin list reuses getActivePromotions(); inactive promotions are hidden after page reload.
  async createPromotion(payload) {
    const response = await api.post('/promotions/admin', payload)
    return unwrap(response)
  },

  async updatePromotion(id, payload) {
    const response = await api.patch(`/promotions/admin/${id}`, payload)
    return unwrap(response)
  },

  async getMyUsages() {
    const response = await api.get('/promotions/me/usages')
    const payload = unwrap(response)
    return Array.isArray(payload) ? payload : []
  },

  // active is Boolean — sent as query param per @RequestParam Boolean active
  async updatePromotionStatus(id, active) {
    const response = await api.patch(`/promotions/admin/${id}/status`, null, {
      params: { active },
    })
    return unwrap(response)
  },

  async deletePromotion(id) {
    const response = await api.delete(`/promotions/admin/${id}`)
    return unwrap(response)
  },
}

export default promotionApi
