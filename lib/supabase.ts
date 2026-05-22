import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Client is created lazily to avoid JWT validation errors at module
// initialization time when env vars are not yet available.
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        'Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      )
    }
    _client = createClient(url, key)
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as Record<string | symbol, unknown>)[prop]
  },
})

export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<string> {
  const client = getClient()
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data: urlData } = client.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function deleteFile(bucket: string, path: string) {
  const client = getClient()
  const { error } = await client.storage.from(bucket).remove([path])
  if (error) throw new Error(`Remoção falhou: ${error.message}`)
}
