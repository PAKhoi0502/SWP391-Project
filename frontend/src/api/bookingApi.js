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

  async createGuestBooking(payload) {
    const response = await api.post('/bookings/guest', payload)
    return unwrap(response)
  },

  async checkGuestPhoneEligibility(phone) {
    const response = await api.post('/bookings/guest/phone-eligibility', { phone })
    return unwrap(response)
  },

  async lookupWalkInCustomer({ phone, licensePlate, vehicleType } = {}) {
    const response = await api.get('/bookings/walk-in/customer-lookup', {
      params: {
        phone,
        ...(licensePlate ? { licensePlate } : {}),
        ...(vehicleType ? { vehicleType } : {}),
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

  async checkInBooking(bookingId, payload = {}) {
    const body = typeof payload === 'string' ? { note: payload } : { ...payload }
    const response = await api.patch(`/bookings/${bookingId}/check-in`, {
      note: body.note?.trim?.() || '',
    })
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

  async getCancellationPreview(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/cancellation-preview`)
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
    const response = await api.post('/payments/payos/create', { bookingId: Number(bookingId), purpose: 'DEPOSIT' })
    return unwrap(response)
  },

  async createDepositPayOSPayment(bookingId) {
    const response = await api.post('/payments/payos/create', { bookingId: Number(bookingId), purpose: 'DEPOSIT' })
    return unwrap(response)
  },

  async createFinalPayOSPayment(bookingId) {
    const response = await api.post('/payments/payos/create', { bookingId: Number(bookingId), purpose: 'FINAL' })
    return unwrap(response)
  },

  async getPaymentTransaction(transactionId) {
    const response = await api.get(`/payments/transactions/${transactionId}`)
    return unwrap(response)
  },

  async cancelPaymentTransaction(transactionId) {
    const response = await api.patch(`/payments/transactions/${transactionId}/cancel`)
    return unwrap(response)
  },

  async updatePaymentMethod(bookingId, paymentMethod) {
    const response = await api.patch(`/bookings/${bookingId}/update-payment-method`, { paymentMethod })
    return unwrap(response)
  },

  async completeBookingServiceStep(stepId, note) {
    const response = await api.patch(`/bookings/booking-service-steps/${stepId}/complete`, { note: note || '' })
    return unwrap(response)
  },

  async reopenBookingServiceStep(stepId, note) {
    const response = await api.patch(`/bookings/booking-service-steps/${stepId}/reopen`, { note: note || '' })
    return unwrap(response)
  },

  // ===================== ISSUE #169 Operation Phase =====================

  getAvailableSlotsWithAddOns({ garageId, servicePackageId, vehicleType, date, isWalkIn = false, addOnServicePackageIds = [] }) {
    return api.get('/bookings/available-slots', {
      params: {
        garage_id: garageId,
        service_package_id: servicePackageId,
        vehicle_type: vehicleType,
        date,
        ...(isWalkIn ? { is_walk_in: true } : {}),
        ...(addOnServicePackageIds.length > 0 ? { add_on_service_package_ids: addOnServicePackageIds } : {}),
      },
    })
  },

  async startWash(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/operations/start-wash`, { note: note || '' })
    return unwrap(response)
  },

  async completeWash(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/operations/complete-wash`, { note: note || '' })
    return unwrap(response)
  },

  async startCare(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/operations/start-care`, { note: note || '' })
    return unwrap(response)
  },

  async completeCare(bookingId, note) {
    const response = await api.patch(`/bookings/${bookingId}/operations/complete-care`, { note: note || '' })
    return unwrap(response)
  },

  async assignCareStaff(bookingId, staffProfileId, reason) {
    const response = await api.patch(`/bookings/${bookingId}/care-assignment`, {
      staffProfileId,
      reason: reason || undefined,
    })
    return unwrap(response)
  },

  async getAvailableCareStaff(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/available-care-staff`)
    return Array.isArray(response?.data?.data) ? response.data.data : []
  },

  async getCareAssignmentStatus(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/care-assignment-status`)
    return response?.data?.data ?? null
  },

  async getAssignedCareStaff(bookingId) {
    const response = await api.get(`/bookings/${bookingId}/assigned-care-staff`)
    return Array.isArray(response?.data?.data) ? response.data.data : []
  },

  async getMyCareTasksAsStaff({ status, date, page = 0, limit = 20 } = {}) {
    const response = await api.get('/bookings/care-tasks/me', {
      params: {
        ...(status && status !== 'ALL' ? { status } : {}),
        ...(date ? { date } : {}),
        page,
        limit,
      },
    })
    return toArray(response)
  },

  async completeFinalInspection(bookingId) {
    const response = await api.patch(`/bookings/${bookingId}/operations/complete-final-inspection`)
    return unwrap(response)
  },

  async recoverCareWorkflow(bookingId) {
    const response = await api.post(`/bookings/${bookingId}/operations/recover-care-workflow`)
    return unwrap(response)
  },

  async getMyReviewedBookingIds() {
    const response = await api.get('/customer/reviews/reviewed-booking-ids')
    const data = unwrap(response)
    return Array.isArray(data) ? data.map(String) : []
  },

  async getStaffBookingSummary() {
    const response = await api.get('/bookings/staff/summary')
    return unwrap(response)
  },

  async getStaffCalendar(year, month) {
    const response = await api.get('/bookings/staff/calendar', { params: { year, month } })
    return unwrap(response) ?? []
  },
}
