import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toArray = (response) => {
  const payload = unwrap(response)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items

  return []
}

export const vehicleInspectionApi = {
  async create(bookingId, payload) {
    const response = await api.post(`/bookings/${bookingId}/inspections`, payload)
    return unwrap(response)
  },

  async listByBooking(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/inspections`)
    return toArray(response)
  },

  async getById(id) {
    const response = await api.get(`/vehicle-inspections/${id}`)
    return unwrap(response)
  },

  async update(id, payload) {
    const response = await api.patch(`/vehicle-inspections/${id}`, payload)
    return unwrap(response)
  },
}
