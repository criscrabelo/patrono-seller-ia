import { uploadFile } from './supabase'

// Upload de mídia feito DIRETO do navegador para o Supabase Storage.
//
// Importante: não usar a rota /api/upload para arquivos grandes. Ela passa pelo
// servidor, e funções na Vercel têm limite de 4,5 MB no corpo da requisição —
// qualquer vídeo (e imagens maiores) falha com 413 antes de chegar no código.
// Enviando direto do navegador, esse limite não se aplica.

export const MAX_IMAGEM = 10 * 1024 * 1024 // 10 MB
export const MAX_VIDEO = 500 * 1024 * 1024 // 500 MB

function formatarMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}

/** Gera um nome de arquivo único para não sobrescrever envios simultâneos. */
function nomeUnico(ext: string): string {
  const aleatorio =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e8).toString(36)
  return `${Date.now()}-${aleatorio}.${ext}`
}

/**
 * Envia uma imagem ou vídeo e devolve a URL pública.
 * `prefixo` organiza os arquivos em pastas (ex.: o id do produto).
 */
export async function enviarMidia(file: File, prefixo: string): Promise<string> {
  const ehVideo = file.type.startsWith('video/')
  const ehImagem = file.type.startsWith('image/')

  if (!ehVideo && !ehImagem) {
    throw new Error('Envie apenas imagens ou vídeos')
  }

  const max = ehVideo ? MAX_VIDEO : MAX_IMAGEM
  if (file.size > max) {
    throw new Error(
      `Arquivo muito grande (${formatarMB(file.size)}). Máximo: ${formatarMB(max)}.`
    )
  }

  const ext = file.name.split('.').pop() || (ehVideo ? 'mp4' : 'png')
  const bucket = ehVideo ? 'videos' : 'imagens'
  return uploadFile(file, bucket, `${prefixo}/${nomeUnico(ext)}`)
}
