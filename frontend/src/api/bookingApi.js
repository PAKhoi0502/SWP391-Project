import api from '../services/api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

const toArray = (response) => {
  const payload = unwrap(response)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  if (Array.isArray(payload?.data?.items)) return payload.data.items

  return []
}

export const bookingApi = {
  getAvailableSlots: ({ garageId, servicePackageId, vehicleType, date, isWalkIn = false }) => {
    return api.get('/bookings/available-slots', {
      params: {
        garage_id: garageId,
        service_package_id: servicePackageId,
        vehicle_type: vehicleType,
        date,
        ...(isWalkIn ? { is_walk_in: true } : {}),
      },
    })
  },

  async getCustomerBookings(status) {
    const response = await api.get('/bookings', {
      params: status && status !== 'ALL' ? { status } : {},
    })
    return toArray(response)
  },

  async getCustomerBookingDetail(id) {
    const response = await api.get(`/bookings/${id}`)
    return unwrap(response)
  },

  async getStaffBookings({ status, date } = {}) {
    const response = await api.get('/bookings/staff/bookings', {
      params: {
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(date ? { date } : {}),
      },
    })
    return toArray(response)
  },

  async createWalkInBooking(payload) {
    const response = await api.post('/bookings/walk-in', payload)
    return unwrap(response)
  },

  async lookupWalkInCustomer({ phone, licensePlate } = {}) {
    const response = await api.get('/bookings/walk-in/customer-lookup', {
      params: {
        phone,
        ...(licensePlate ? { licensePlate } : {}),
      },
    })
    return unwrap(response)
  },

  async getAdminBookings({ garageId, status, paymentStatus } = {}) {
    const response = await api.get('/bookings/admin/bookings', {
      params: {
        ...(garageId ? { garageId } : {}),
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(paymentStatus && paymentStatus !== 'ALL' ? { paymentStatus } : {}),
      },
    })
    return toArray(response)
  },

  async getBookingServiceSteps(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/service-steps`)
    return toArray(response)
  },

  async getPaymentTransactions(bookingId) {
    const response = await api.get(`/payments/bookings/${bookingId}/payment-transactions`)
    return toArray(response)
  },

  async checkInBooking(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/check-in`, { note })
    return unwrap(response)
  },

  async startService(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/start-service`, { note })
    return unwrap(response)
  },

  async completeService(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/complete-service`, { note })
    return unwrap(response)
  },

  async markBookingPaid(bookingId, { paymentMethod = 'CASH', note } = {}) {
    const response = await api.patch(`/bookings/${bookingId}/mark-paid`, { paymentMethod, note })
    return unwrap(response)
  },

  async cancelBooking(bookingId, reason) {
    const response = await api.patch(`/bookings/${bookingId}/cancel`, { reason })
    return unwrap(response)
  },

  async markNoShow(bookingId, reason) {
    const response = await api.patch(`/bookings/${bookingId}/no-show`, { reason })
    return unwrap(response)
  },

  async createPayOSPayment(bookingId) {
    const response = await api.post('/payments/payos/create', { bookingId: Number(bookingId) })
    return unwrap(response)
  },
}
