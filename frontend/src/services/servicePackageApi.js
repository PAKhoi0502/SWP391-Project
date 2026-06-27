import api from './api'

export const PACKAGE_TYPES = ['MAIN', 'ADD_ON', 'COMBO']
export const VEHICLE_TYPES = ['CAR', 'MOTORBIKE']

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return value !== undefined && value !== null && value !== '' && value !== 'ALL'
    })
  )
}

function unwrap(response) {
  return response?.data?.data ?? response?.data
}

export function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

export function getPackageId(item) {
  return item?.servicePackageId ?? item?.packageId ?? item?.id
}

export function getPackageName(item) {
  return item?.name ?? item?.packageName ?? item?.servicePackageName ?? 'Gói dịch vụ'
}

export function getPackageType(item) {
  return item?.serviceType ?? item?.packageType ?? item?.type ?? item?.servicePackageType ?? 'MAIN'
}

export function getPackagePrice(item) {
  return item?.price ?? item?.basePrice ?? item?.totalPrice ?? 0
}

export function getPackageDuration(item) {
  return item?.durationMinutes ?? item?.estimatedDurationMinutes ?? item?.duration ?? 0
}

export function getPackageActive(item) {
  if (typeof item?.isActive === 'boolean') return item.isActive
  if (typeof item?.active === 'boolean') return item.active
  if (typeof item?.enabled === 'boolean') return item.enabled
  if (typeof item?.status === 'string') return item.status.toUpperCase() !== 'INACTIVE'
  return true
}

export function getErrorMessage(error, fallback = 'Có lỗi xảy ra') {
  const data = error?.response?.data
  return data?.message || data?.error || (typeof data === 'string' ? data : '') || error?.message || fallback
}

export async function getServicePackages(params = {}) {
  const response = await api.get('/service-packages', {
    params: cleanParams(params),
  })
  return unwrap(response)
}

export async function getAvailableServicePackages(params = {}) {
  const response = await api.get('/service-packages/available', {
    params: cleanParams(params),
  })
  return unwrap(response)
}

export async function getServicePackageById(id) {
  const response = await api.get(`/service-packages/${id}`)
  return unwrap(response)
}

export async function createServicePackage(payload) {
  const response = await api.post('/service-packages', payload)
  return unwrap(response)
}

export async function updateServicePackage(id, payload) {
  const response = await api.patch(`/service-packages/${id}`, payload)
  return unwrap(response)
}

export async function updateServicePackageStatus(id, isActive) {
  try {
    const response = await api.patch(`/service-packages/${id}/status`, {
      isActive,
      active: isActive,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
    })
    return unwrap(response)
  } catch (error) {
    const status = error?.response?.status

    if (status === 400 || status === 415) {
      const response = await api.patch(`/service-packages/${id}/status`, null, {
        params: {
          isActive,
          active: isActive,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
        },
      })
      return unwrap(response)
    }

    throw error
  }
}