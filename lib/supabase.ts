import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function uploadFile(
  file: File,
  bucket: string,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw new Error(`Remoção falhou: ${error.message}`)
}

/** Igual a `uploadFile`, mas para quando já se tem um Buffer (ex.: saída do FFmpeg) em vez de um `File` do navegador. */
export async function uploadBuffer(
  buffer: Buffer,
  bucket: string,
  path: string,
  contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { upsert: true, contentType })

  if (error) throw new Error(`Upload falhou: ${error.message}`)

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

// ── Storage PRIVADO (Rodada 7 — Digital Twin) ────────────────────────────
// Rosto/voz/vídeo de referência da proprietária são ativos sensíveis:
// nunca em bucket público, nunca com URL permanente. Usa o client
// service-role (mesmo padrão de app/api/upload/*) porque o client anônimo
// não tem permissão de escrita/leitura num bucket privado.

const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder')

/** Upload para um bucket PRIVADO — nunca gera URL pública. */
export async function uploadBufferPrivado(buffer: Buffer, bucket: string, path: string, contentType: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { upsert: true, contentType })
  if (error) throw new Error(`Upload privado falhou: ${error.message}`)
  return data.path
}

/** URL assinada temporária — único jeito de acessar um arquivo do bucket privado. */
export async function criarUrlAssinada(bucket: string, path: string, expiraEmSegundos: number = 300): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiraEmSegundos)
  if (error || !data) throw new Error(`Falha ao gerar URL assinada: ${error?.message ?? 'sem dados'}`)
  return data.signedUrl
}

export async function deleteFilePrivado(bucket: string, path: string) {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path])
  if (error) throw new Error(`Remoção privada falhou: ${error.message}`)
}
