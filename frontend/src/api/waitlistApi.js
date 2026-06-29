// Mock waitlist store dùng chung cho cả customer và staff.
// Tất cả API trả Promise để component không phải đổi code khi backend có thật.
//
// Lưu ở localStorage key "customerWaitlistItems" (giữ tương thích ngược với
// customerWaitlistItems đã có). Khi backend có endpoint thật, chỉ cần thay body
// của các hàm này bằng axiosClient.get/post — UI không phải đổi.
const WAITLIST_STORAGE_KEY = 'customerWaitlistItems'

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function readItems() {
  try {
    return JSON.parse(localStorage.getItem(WAITLIST_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeItems(items) {
  localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(items))
}

function updateItem(id, changes) {
  const now = new Date().toISOString()
  const items = readItems().map((item) =>
    String(item.id) === String(id) ? { ...item, ...changes, updatedAt: now } : item,
  )

  writeItems(items)
  return items.find((item) => String(item.id) === String(id)) || null
}

export const waitlistApi = {
  join(payload) {
    const now = new Date().toISOString()
    const entry = {
      ...cleanPayload(payload),
      id: crypto.randomUUID(),
      status: 'WAITING',
      position: readItems().filter((i) => i.garageId === payload.garageId && i.startTime === payload.startTime && i.status === 'WAITING').length + 1,
      createdAt: now,
      updatedAt: now,
    }

    writeItems([entry, ...readItems()])
    return Promise.resolve(entry)
  },

  getMine() {
    return Promise.resolve(readItems())
  },

  cancel(id) {
    return Promise.resolve(updateItem(id, { status: 'CANCELLED', canceledAt: new Date().toISOString() }))
  },

  accept(id) {
    return Promise.resolve(updateItem(id, { status: 'ACCEPTED', acceptedAt: new Date().toISOString() }))
  },

  // ===== Staff =====
  getQueue({ status } = {}) {
    const normalized = status ? String(status).toUpperCase() : 'WAITING'
    const items = readItems().filter((item) => {
      const itemStatus = String(item.status || 'WAITING').toUpperCase()
      if (normalized === 'ALL') return true
      return itemStatus === normalized
    })
    return Promise.resolve(items)
  },

  approve(id, staffUserId) {
    return Promise.resolve(
      updateItem(id, {
        status: 'ACCEPTED',
        decidedByStaffId: staffUserId,
        decidedAt: new Date().toISOString(),
      }),
    )
  },

  reject(id, staffUserId, reason) {
    return Promise.resolve(
      updateItem(id, {
        status: 'REJECTED',
        rejectedReason: reason || null,
        decidedByStaffId: staffUserId,
        decidedAt: new Date().toISOString(),
      }),
    )
  },
}
