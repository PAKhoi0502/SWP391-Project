const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export const getNotificationBookingNumber = (notification, fallbackMap = new Map()) =>
  notification?.customerBookingNumber ??
  (notification?.bookingId == null ? null : fallbackMap.get(Number(notification.bookingId))) ??
  null

const replaceRawBookingId = (message, notification, fallbackMap) => {
  if (!message || notification?.bookingId == null) return message || ''
  const displayNumber = getNotificationBookingNumber(notification, fallbackMap)
  if (displayNumber == null) return message

  return message.replace(
    new RegExp(`#${notification.bookingId}\\b`, 'g'),
    `#${displayNumber}`,
  )
}

const formatLegacyRefundAmount = (message) => {
  if (!message || /(?:₫|\bVND\b)/i.test(message)) return message

  return message.replace(
    /(deposit refund(?: request)? of)\s+(\d+(?:[.,]\d+)?)/i,
    (_, prefix, rawAmount) => {
      const amount = Number(rawAmount.replace(/,/g, ''))
      return Number.isFinite(amount)
        ? `${prefix} ${vnd.format(amount)}`
        : `${prefix} ${rawAmount}`
    },
  )
}

export const presentNotificationMessage = (notification, fallbackMap = new Map()) => {
  const withBookingNumber = replaceRawBookingId(
    notification?.message || '',
    notification,
    fallbackMap,
  )

  if (String(notification?.eventType || '').toUpperCase().startsWith('DEPOSIT_REFUND_')) {
    return formatLegacyRefundAmount(withBookingNumber)
  }

  return withBookingNumber
}
