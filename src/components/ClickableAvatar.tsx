'use client'

import { Camera } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

function isValidUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

type ClickableAvatarProps = {
  imageUrl: string | null
  initials: string
  initialsClassName: string
  placeholderClassName?: string
  disabled?: boolean
  bordered?: boolean
  ariaLabel?: string
  onUpload: (file: File) => Promise<string | null>
  onDelete?: () => Promise<void>
  onClickWhenDisabled?: () => void
}

export function ClickableAvatar({
  imageUrl,
  initials,
  initialsClassName,
  placeholderClassName,
  disabled = false,
  bordered = true,
  ariaLabel = 'Añadir foto',
  onUpload,
  onDelete,
  onClickWhenDisabled,
}: ClickableAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewObjectUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showPhotoActions, setShowPhotoActions] = useState(false)

  const clearPreview = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setPreviewUrl(null)
  }

  useEffect(() => {
    setImageError(false)
  }, [imageUrl, previewUrl])

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  const resolvedUrl = previewUrl ?? imageUrl
  const hasPhoto = Boolean(resolvedUrl?.trim())
  const showImage = hasPhoto && isValidUrl(resolvedUrl!) && !imageError
  const busy = uploading || deleting

  const openPicker = () => {
    if (disabled) {
      onClickWhenDisabled?.()
      return
    }
    if (busy) return
    requestAnimationFrame(() => {
      fileInputRef.current?.click()
    })
  }

  const handleAvatarPress = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (disabled) {
      onClickWhenDisabled?.()
      return
    }
    if (busy) return
    if (hasPhoto && onDelete) {
      setShowPhotoActions(true)
      return
    }
    openPicker()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      return
    }

    clearPreview()
    const objectUrl = URL.createObjectURL(file)
    previewObjectUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)
    setImageError(false)
    setUploading(true)

    try {
      const newUrl = await onUpload(file)
      if (!newUrl) {
        clearPreview()
        return
      }
      clearPreview()
    } catch {
      clearPreview()
    } finally {
      setUploading(false)
    }
  }

  const handleReplacePhoto = () => {
    setShowPhotoActions(false)
    openPicker()
  }

  const handleDeletePhoto = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      clearPreview()
      setShowPhotoActions(false)
    } finally {
      setDeleting(false)
    }
  }

  const borderClass = bordered ? 'border border-dashed border-gray-300' : ''

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={(event) => void handleFileChange(event)}
      />
      <button
        type="button"
        onClick={handleAvatarPress}
        disabled={busy && !disabled}
        className={`group/avatar relative h-16 w-16 shrink-0 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default disabled:opacity-50 ${placeholderClassName ?? ''}`}
        aria-label={hasPhoto && onDelete ? 'Opciones de foto' : ariaLabel}
      >
        {showImage ? (
          <img
            src={resolvedUrl!}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className={`avatar-soft h-16 w-16 rounded-full object-cover ${borderClass}`}
          />
        ) : (
          <div
            className={`avatar-soft flex h-16 w-16 items-center justify-center rounded-full text-base font-semibold ${borderClass} ${initialsClassName}`}
            aria-hidden
          >
            {initials}
          </div>
        )}
        {!disabled ? (
          <div
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/30 transition-opacity ${
              busy ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100'
            }`}
          >
            {busy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Camera className="h-3 w-3 text-white" strokeWidth={2} aria-hidden />
            )}
          </div>
        ) : null}
      </button>

      {showPhotoActions && onDelete ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) setShowPhotoActions(false)
          }}
        >
          <div
            className="w-full max-w-[16rem] rounded-xl bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-photo-action-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="avatar-photo-action-title" className="text-sm font-semibold text-gray-900">
              Foto
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={handleReplacePhoto}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cambiar foto
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeletePhoto()}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Eliminar foto'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowPhotoActions(false)}
                className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
