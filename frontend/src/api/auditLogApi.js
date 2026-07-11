import api from '../services/api'

export const AUDIT_ACTIONS = [
  'BOOKING_CREATED',
  'BOOKING_WALK_IN_CREATED',
  'BOOKING_CHECKED_IN',
  'BOOKING_SERVICE_STARTED',
  'BOOKING_CANCELLED',
  'BOOKING_MARKED_NO_SHOW',
  'BOOKING_SERVICE_STEP_COMPLETED',
  'BOOKING_SERVICE_STEP_REOPENED',
  'BOOKING_SERVICE_COMPLETED',
  'BOOKING_MARK_PAID',
  'BOOKING_PAYMENT_METHOD_UPDATED',
  'PAYMENT_LINK_CREATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_FAILED',
  'PAYMENT_TRANSACTION_CANCELLED',
  'USER_STATUS_UPDATED',
  'USER_ROLE_UPDATED',
  'STAFF_PROFILE_CREATED',
  'STAFF_PROFILE_UPDATED',
  'STAFF_PROFILE_STATUS_UPDATED',
  'GARAGE_CREATED',
  'GARAGE_UPDATED',
  'GARAGE_STATUS_UPDATED',
  'WASH_BAY_CREATED',
  'WASH_BAY_UPDATED',
  'WASH_BAY_STATUS_UPDATED',
  'SERVICE_PACKAGE_CREATED',
  'SERVICE_PACKAGE_UPDATED',
  'SERVICE_PACKAGE_STATUS_UPDATED',
  'PROMOTION_CREATED',
  'PROMOTION_UPDATED',
  'PROMOTION_STATUS_UPDATED',
  'PROMOTION_DELETED',
  'PROMOTION_VOUCHER_SENT',
  'LOYALTY_TIER_RULE_CREATED',
  'LOYALTY_TIER_RULE_UPDATED',
  'LOYALTY_POINTS_ADJUSTED',
]

export const AUDIT_TARGET_TYPES = [
  'BOOKING',
  'BOOKING_SERVICE_STEP',
  'PAYMENT_TRANSACTION',
  'USER',
  'STAFF_PROFILE',
  'GARAGE',
  'WASH_BAY',
  'SERVICE_PACKAGE',
  'PROMOTION',
  'LOYALTY_TIER_RULE',
  'CUSTOMER_LOYALTY',
]

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function unwrap(response) {
  return response?.data?.data ?? response?.data
}

export const auditLogApi = {
  async list({ page = 1, limit = 10, actorId, action, targetType, from, to } = {}) {
    const params = cleanParams({
      page,
      limit,
      actor_id: actorId,
      action,
      target_type: targetType,
      from,
      to,
    })
    const response = await api.get('/admin/audit-logs', { params })
    return unwrap(response)
  },

  async getById(id) {
    const response = await api.get(`/admin/audit-logs/${id}`)
    return unwrap(response)
  },
}
