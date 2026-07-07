import { useEffect, useRef, useState } from 'react'
import { uploadService } from '../../services/uploadService'
import { Button, Modal } from '../common/ui'
import './ImageUpload.css'

const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DEFAULT_MAX_SIZE_MB = 5

function ImageUpload({
  folder,
  entityId,
  images = [],
  onUploaded,
  onDeleted,
  multiple = true,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  disabled = false,
  allowDelete = true,
  className = '',
}) {
  const [pendingFile, setPendingFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deletingPublicId, setDeletingPublicId] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')

    if (!acceptedTypes.includes(file.type)) {
      setError('Định dạng ảnh không được hỗ trợ.')
      return
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ảnh không được vượt quá ${maxSizeMB} MB.`)
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl('')
  }

  const handleConfirmUpload = async () => {
    if (!pendingFile) return

    setUploading(true)
    setError('')

    try {
      const uploaded = await uploadService.uploadImage(pendingFile, folder, entityId)
      onUploaded?.(uploaded)
      handleCancelPreview()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không tải được ảnh lên.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (publicId) => {
    setDeletingPublicId(publicId)
    setError('')

    try {
      await uploadService.deleteImage(publicId)
      onDeleted?.(publicId)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không xóa được ảnh.')
    } finally {
      setDeletingPublicId('')
    }
  }

  const canAddMore = !disabled && !pendingFile && (multiple || images.length === 0)

  return (
    <div className={`image-upload ${className}`.trim()}>
      <div className="image-upload-grid">
        {images.map((image) => (
          <div className="image-upload-thumb" key={image.publicId || image.id}>
            <img src={image.imageUrl} alt="Uploaded" />
            {allowDelete && !disabled && (
              <button
                type="button"
                className="image-upload-remove"
                disabled={deletingPublicId === image.publicId}
                onClick={() => handleDelete(image.publicId)}
                aria-label="Xóa ảnh"
              >
                {deletingPublicId === image.publicId ? '...' : '✕'}
              </button>
            )}
          </div>
        ))}

        {canAddMore && (
          <label className="image-upload-add">
            <span>+ Thêm ảnh</span>
            <input
              ref={inputRef}
              type="file"
              accept={acceptedTypes.join(',')}
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {error && <p className="image-upload-error">{error}</p>}

      <Modal
        open={Boolean(pendingFile)}
        title="Xem trước ảnh"
        onClose={uploading ? undefined : handleCancelPreview}
        footer={
          <>
            <Button variant="ghost" disabled={uploading} onClick={handleCancelPreview}>
              Hủy
            </Button>
            <Button variant="primary" loading={uploading} onClick={handleConfirmUpload}>
              Tải lên
            </Button>
          </>
        }
      >
        {previewUrl && <img src={previewUrl} alt="Xem trước" className="image-upload-preview-img" />}
      </Modal>
    </div>
  )
}

export default ImageUpload
