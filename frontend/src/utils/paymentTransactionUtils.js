// A PayOS PENDING transaction is still payable until it expires — reusing it
// avoids the backend silently expiring the old one and minting a new order code
// every time the payment modal is reopened (see PaymentServiceImpl#createPayOSPaymentCore).
export function findActivePendingTransaction(transactions, purpose) {
  if (!Array.isArray(transactions)) return null
  const now = Date.now()
  return (
    transactions.find((tx) => {
      if (String(tx?.status || '').toUpperCase() !== 'PENDING') return false
      if (purpose && String(tx?.purpose || '').toUpperCase() !== purpose) return false
      if (tx?.expiredAt && new Date(tx.expiredAt).getTime() <= now) return false
      return true
    }) || null
  )
}
