import api from '../services/api'

const unwrap = (response) => {
  return response?.data?.data ?? response?.data ?? response
}

const toArray = (value) => {
  const payload = unwrap(value)

  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.slots)) return payload.slots
  if (Array.isArray(payload?.availableSlots)) return payload.availableSlots
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.slots)) return payload.data.slots
  if (Array.isArray(payload?.data?.availableSlots)) return payload.data.availableSlots
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  if (Array.isArray(payload?.data?.items)) return payload.data.items

  return []
}

const getVehicleId = (vehicle) => vehicle?.vehicleId ?? vehicle?.id

const getGarageId = (garage) => garage?.garageId ?? garage?.id

const getServicePackageId = (servicePackage) =>
  servicePackage?.servicePackageId ?? servicePackage?.packageId ?? servicePackage?.id

const getSlotId = (slot) => slot?.slotId ?? slot?.id ?? slot?.startTime

const getVehicleType = (vehicle) => {
  const raw =
    vehicle?.vehicleType ||
    vehicle?.vehicle_type ||
    vehicle?.type ||
    vehicle?.category ||
    ''

  const value = String(raw).trim().toUpperCase()

  if (value === 'CAR' || value === 'AUTO' || value === 'Ô TÔ') return 'CAR'

  if (
    value === 'BIKE' ||
    value === 'MOTORBIKE' ||
    value === 'MOTORCYCLE' ||
    value === 'XE_MAY' ||
    value === 'XE MÁY'
  ) {
    return 'MOTORBIKE'
  }

  return value
}

const getPackagePrice = (servicePackage) => {
  return Number(
    servicePackage?.price ??
      servicePackage?.basePrice ??
      servicePackage?.totalPrice ??
      servicePackage?.amount ??
      0,
  )
}

const getDiscountAmount = (result) => {
  const payload = unwrap(result)

  return Number(
    payload?.discountAmount ??
      payload?.discount ??
      payload?.amount ??
      payload?.data?.discountAmount ??
      0,
  )
}

const isPackageActive = (item) => {
  if (item?.isActive === false) return false
  if (item?.active === false) return false
  if (item?.enabled === false) return false
  if (String(item?.status || 'ACTIVE').toUpperCase() === 'INACTIVE') return false

  return true
}

const getPackageVehicleType = (item) => {
  const raw =
    item?.vehicleType ||
    item?.vehicle_type ||
    item?.supportedVehicleType ||
    item?.vehicleCategory ||
    ''

  const value = String(raw).trim().toUpperCase()

  if (value === 'CAR' || value === 'AUTO' || value === 'Ô TÔ') return 'CAR'

  if (
    value === 'BIKE' ||
    value === 'MOTORBIKE' ||
    value === 'MOTORCYCLE' ||
    value === 'XE_MAY' ||
    value === 'XE MÁY'
  ) {
    return 'MOTORBIKE'
  }

  return value
}

export const customerBookingFlowApi = {
  async getVehicles() {
    const response = await api.get('/api/vehicles')
    return toArray(response)
  },

  async getGarages() {
    const response = await api.get('/api/garages')
    return toArray(response)
  },

  async getAvailableServicePackages({ garageId, vehicle }) {
    const vehicleType = getVehicleType(vehicle)

    try {
      const response = await api.get('/service-packages/available', {
        params: {
          garageId,
          vehicleType,
          vehicleId: getVehicleId(vehicle),
        },
      })

      const list = toArray(response)

      if (list.length > 0) return list
    } catch (error) {
      // Fallback xuống danh sách gói dịch vụ chung nếu endpoint available lỗi.
    }

    const fallbackResponse = await api.get('/service-packages', {
      params: {
        vehicleType,
        isActive: true,
      },
    })

    return toArray(fallbackResponse).filter((item) => {
      const packageVehicleType = getPackageVehicleType(item)

      return (
        isPackageActive(item) &&
        (!packageVehicleType || packageVehicleType === vehicleType)
      )
    })
  },

  async getAvailableSlots({ garageId, servicePackageId, vehicle, date }) {
    const response = await api.get('/bookings/available-slots', {
      params: {
        garage_id: garageId,
        service_package_id: servicePackageId,
        vehicle_type: getVehicleType(vehicle),
        date,
      },
    })

    return toArray(response)
  },

  async validatePromotion(payload) {
    const response = await api.post('/promotions/validate', payload)
    return unwrap(response)
  },

  async redeemPreview(payload) {
    const response = await api.post('/loyalty/redeem-preview', payload)
    return unwrap(response)
  },

  async redeemLoyaltyPreview(payload) {
    const response = await api.post('/loyalty/redeem-preview', payload)
    return unwrap(response)
  },

  async createBooking(payload) {
  const response = await api.post('/bookings', payload)
  return unwrap(response)
},

async getCustomerBookings() {
  const response = await api.get('/bookings')
  return toArray(response)
},

async cancelBooking(bookingId) {
  const response = await api.patch(`/bookings/${bookingId}/cancel`)
  return unwrap(response)
},
}

export const bookingFlowUtils = {
  toArray,
  getVehicleId,
  getGarageId,
  getServicePackageId,
  getSlotId,
  getVehicleType,
  getPackagePrice,
  getDiscountAmount,
}

export default customerBookingFlowApi
