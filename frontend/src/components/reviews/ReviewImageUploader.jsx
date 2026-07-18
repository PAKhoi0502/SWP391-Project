import { useRef, useState } from 'react'
import './ReviewImageUploader.css'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

export default function ReviewImageUploader({
  images = [],
  onChange,
  disabled = false,
  maxCount = 5,
}) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')

  const handleFileChange = (e) => {
    setError('')
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remaining = maxCount - images.length
    if (remaining <= 0) {
      setError(`Maximum ${maxCount} photos allowed`)
      e.target.value = ''
      return
    }

    const toAdd = []
    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a supported image type`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`"${file.name}" exceeds the 5 MB size limit`)
        continue
      }
      const previewUrl = URL.createObjectURL(file)
      toAdd.push({ id: `${Date.now()}-${Math.random()}`, file, previewUrl })
    }

    if (toAdd.length > 0) {
      onChange([...images, ...toAdd])
    }

    e.target.value = ''
  }

  const handleRemove = (id) => {
    const img = images.find((i) => i.id === id)
    if (img?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(img.previewUrl)
    }
    onChange(images.filter((i) => i.id !== id))
    setError('')
  }

  const canAdd = !disabled && images.length < maxCount

  return (
    <div className="riu-wrap">
      {canAdd && (
        <>
          <button
            type="button"
            className="riu-add-btn"
            onClick={() => inputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add photos ({images.length}/{maxCount})
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="riu-hidden-input"
            onChange={handleFileChange}
          />
        </>
      )}

      {images.length > 0 && (
        <div className="riu-grid">
          {images.map((img) => (
            <div key={img.id} className="riu-thumb">
              <img
                src={img.previewUrl}
                alt="Review photo"
                className="riu-thumb-img"
              />
              {!disabled && (
                <button
                  type="button"
                  className="riu-remove-btn"
                  onClick={() => handleRemove(img.id)}
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="riu-error">{error}</p>}
    </div>
  )
}
