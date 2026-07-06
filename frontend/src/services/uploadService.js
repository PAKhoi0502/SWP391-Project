import api from './api'

const unwrap = (response) => response?.data?.data ?? response?.data ?? response

export const uploadService = {
  async uploadImage(file, folder, entityId) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    if (entityId !== undefined && entityId !== null) {
      formData.append('entity_id', String(entityId))
    }

    const response = await api.post('/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return unwrap(response)
  },

  async deleteImage(publicId) {
    const response = await api.delete('/uploads/images', {
      data: { public_id: publicId },
    })
    return unwrap(response)
  },
}
