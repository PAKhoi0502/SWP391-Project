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
    const items = JSON.parse(localStorage.getItem(WAITLIST_STORAGE_KEY) || '[]')
    if (!Array.isArray(items)) return []

    // Vá id cho các item cũ (được lưu trước khi mọi nơi tạo waitlist đều
    // đi qua waitlistApi.join()) để tránh nhiều item không có id bị coi
    // là "cùng một item" khi duyệt/từ chối.
    let didPatch = false
    const patched = items.map((item) => {
      if (item?.id !== undefined && item?.id !== null && item?.id !== '') return item
      didPatch = true
      return { ...item, id: crypto.randomUUID() }
    })

    if (didPatch) writeItems(patched)
    return patched
  } catch {
    return []
  }
}

function writeItems(items) {
  localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(items))
}

function updateItem(id, changes) {
  // Guard: không cho phép cập nhật khi thiếu id, vì String(undefined) sẽ
  // khớp với mọi item không có id (bug cũ khiến "từ chối 1 người" lại
  // từ chối luôn cả những item không có id khác).
  if (id === undefined || id === null || id === '') {
    return null
  }

  const now = new Date().toISOString()
  const items = readItems().map((item) =>
    item.id !== undefined && item.id !== null && String(item.id) === String(id)
      ? { ...item, ...changes, updatedAt: now }
      : item,
  )

  writeItems(items)
  return items.find((item) => String(item.id) === String(id)) || null
}

export const waitlistApi = {
  join(payload) {
    const now = new Date().toISOString()
    const existingItems = readItems()
    // Lấy vị trí lớn nhất hiện có cho khung giờ này và cộng thêm 1
    const sameSlotItems = existingItems.filter((i) =>
      i.garageId === payload.garageId &&
      i.startTime === payload.startTime
    )
    const maxPosition = sameSlotItems.length > 0
      ? Math.max(...sameSlotItems.map(i => i.position || 0))
      : 0
    const position = maxPosition + 1

    const entry = {
      ...cleanPayload(payload),
      id: crypto.randomUUID(),
      status: 'WAITING',
      customerId: payload.customerId || 'Guest',
      customerName: payload.customerName || 'Khách hàng',
      position: position,
      createdAt: now,
      updatedAt: now,
    }

    writeItems([...readItems(), entry])
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
