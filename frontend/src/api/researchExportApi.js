import api from '../services/api'

const parseFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition)
  return match ? decodeURIComponent(match[1]) : fallback
}

const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const extractErrorMessage = async (error) => {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      return JSON.parse(text)?.message || text
    } catch {
      return error.message
    }
  }
  return error?.response?.data?.message || error.message
}

const download = async (endpoint, { from, to, format } = {}, fallbackName) => {
  try {
    const response = await api.get(endpoint, {
      params: { from, to, format },
      responseType: 'blob',
    })
    const filename = parseFilename(response.headers['content-disposition'], `${fallbackName}.${format || 'csv'}`)
    triggerDownload(response.data, filename)
  } catch (error) {
    throw new Error(await extractErrorMessage(error))
  }
}

const researchExportApi = {
  async exportBookings(filters) {
    return download('/admin/research/bookings/export', filters, 'bookings-export')
  },

  async exportCustomers(filters) {
    return download('/admin/research/customers/export', filters, 'customers-export')
  },
}

export default researchExportApi
