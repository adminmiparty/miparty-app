import type { SupabaseClient } from '@supabase/supabase-js'

const AVATAR_BUCKET = 'avatars'

export function avatarStoragePathFromUrl(url: string): string | null {
  const match = url.match(/\/avatars\/(.+?)(?:\?|$)/)
  return match?.[1] ?? null
}

export function safeImageExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext
  return 'jpg'
}

export async function uploadAvatarFile(
  supabase: SupabaseClient,
  storagePath: string,
  file: File
): Promise<{ publicUrl: string } | { error: string }> {
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type,
  })
  if (uploadError) {
    return { error: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath)
  return { publicUrl: `${publicUrl}?t=${Date.now()}` }
}

export async function removeAvatarFile(supabase: SupabaseClient, avatarUrl: string): Promise<void> {
  const storagePath = avatarStoragePathFromUrl(avatarUrl)
  if (storagePath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([storagePath])
  }
}
