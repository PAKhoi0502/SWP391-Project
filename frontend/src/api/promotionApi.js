import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const promotionApi = {
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
}

export default promotionApi
