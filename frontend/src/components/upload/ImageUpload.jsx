import { useEffect, useRef, useState } from 'react'
import { uploadService } from '../../services/uploadService'
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
  avatarMode = false,
  avatarFallback = null,
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

  const validateFile = (file) => {
    if (!acceptedTypes.includes(file.type)) {
      setError('This image format is not supported.')
      return false
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Image must not exceed ${maxSizeMB} MB.`)
      return false
    }
    return true
  }

  // Avatar mode keeps the confirm-before-upload modal (unchanged).
  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    if (!validateFile(file)) return

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
      setError(err?.response?.data?.message || err?.message || 'Failed to upload image.')
    } finally {
      setUploading(false)
    }
  }

  // Grid mode: picking a photo previews and uploads it immediately — no separate confirm step.
  const handleGridFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    if (!validateFile(file)) return

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
    setUploading(true)

    try {
      const uploaded = await uploadService.uploadImage(file, folder, entityId)
      onUploaded?.(uploaded)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to upload image.')
    } finally {
      URL.revokeObjectURL(localUrl)
      setPreviewUrl('')
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
      setError(err?.response?.data?.message || err?.message || 'Failed to delete image.')
    } finally {
      setDeletingPublicId('')
    }
  }

  const canAddMore = !disabled && !uploading && (multiple || images.length === 0)

  if (avatarMode) {
    const currentImage = images[0] || null
    return (
      <div className={`image-upload image-upload--avatar ${className}`.trim()}>
        <label className="image-upload-avatar-label">
          <div className="image-upload-avatar-circle">
            {currentImage
              ? <img src={currentImage.imageUrl} alt="avatar" />
              : avatarFallback
            }
            {!disabled && (
              <div className="image-upload-avatar-overlay">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span>{currentImage ? 'Change photo' : 'Add photo'}</span>
              </div>
            )}
          </div>
          {!disabled && (
            <input
              ref={inputRef}
              type="file"
              accept={acceptedTypes.join(',')}
              onChange={handleAvatarFileChange}
              style={{ display: 'none' }}
            />
          )}
        </label>

        {allowDelete && currentImage && !disabled && (
          <button
            type="button"
            className="image-upload-avatar-delete"
            disabled={deletingPublicId === currentImage.publicId}
            onClick={() => handleDelete(currentImage.publicId)}
            aria-label="Delete image"
          >
            {deletingPublicId === currentImage.publicId ? '…' : '✕'}
          </button>
        )}

        {error && <p className="image-upload-error" style={{ textAlign: 'center', marginTop: 6 }}>{error}</p>}

        {Boolean(pendingFile) && (
          <div className="image-upload-avatar-modal-overlay" onClick={uploading ? undefined : handleCancelPreview}>
            <div className="image-upload-avatar-modal" onClick={(e) => e.stopPropagation()}>
              <p className="image-upload-avatar-modal-title">Preview Avatar</p>
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="image-upload-avatar-modal-img" />
              )}
              <div className="image-upload-avatar-modal-actions">
                <button type="button" className="image-upload-avatar-modal-cancel" disabled={uploading} onClick={handleCancelPreview}>
                  Cancel
                </button>
                <button type="button" className="image-upload-avatar-modal-confirm" disabled={uploading} onClick={handleConfirmUpload}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

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
                aria-label="Delete image"
              >
                {deletingPublicId === image.publicId ? '...' : '✕'}
              </button>
            )}
          </div>
        ))}

        {uploading && previewUrl && (
          <div className="image-upload-thumb image-upload-thumb--pending">
            <img src={previewUrl} alt="Uploading" />
            <div className="image-upload-thumb-spinner" aria-label="Uploading…" />
          </div>
        )}

        {canAddMore && (
          <label className="image-upload-add">
            <span>+ Add photo</span>
            <input
              ref={inputRef}
              type="file"
              accept={acceptedTypes.join(',')}
              onChange={handleGridFileChange}
            />
          </label>
        )}
      </div>

      {error && <p className="image-upload-error">{error}</p>}
    </div>
  )
}

export default ImageUpload
