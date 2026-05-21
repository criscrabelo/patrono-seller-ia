// Publicação de Reels no Instagram via Instagram Graph API (Meta).
// Requer um Access Token e o ID da conta comercial do Instagram,
// configurados na página de Integrações.

const API_VERSION = 'v21.0'
// Instagram API com Login do Instagram (graph.instagram.com) — usada quando
// o app é configurado com "API setup with Instagram login".
const BASE = `https://graph.instagram.com/${API_VERSION}`

export interface PublicarReelParams {
  accessToken: string
  igUserId: string
  videoUrl: string
  legenda: string
}

async function fbFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    const msg = data?.error?.message || `Erro HTTP ${res.status} na API do Instagram`
    throw new Error(msg)
  }
  return data
}

/**
 * Publica um Reels no Instagram.
 * 1) cria o container de mídia, 2) aguarda o processamento do vídeo,
 * 3) publica. Retorna o ID da mídia publicada.
 */
export async function publicarReelInstagram({
  accessToken,
  igUserId,
  videoUrl,
  legenda,
}: PublicarReelParams): Promise<string> {
  // 1. Cria o container de mídia (REELS)
  const criar = await fbFetch(`${BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: legenda,
      access_token: accessToken,
    }),
  })
  const containerId = criar.id as string
  if (!containerId) throw new Error('Instagram não retornou o ID do container de mídia')

  // 2. Aguarda o Instagram processar o vídeo (Reels leva alguns segundos)
  const MAX_POLLS = 8
  const INTERVALO = 5000
  let pronto = false
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, INTERVALO))
    const status = await fbFetch(
      `${BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
    )
    if (status.status_code === 'FINISHED') {
      pronto = true
      break
    }
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`O Instagram falhou ao processar o vídeo (${status.status_code})`)
    }
  }
  if (!pronto) {
    throw new Error(
      'O vídeo ainda está sendo processado pelo Instagram. Tente publicar novamente em instantes.'
    )
  }

  // 3. Publica o container
  const publicar = await fbFetch(`${BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  })
  const mediaId = publicar.id as string
  if (!mediaId) throw new Error('Instagram não retornou o ID da publicação')
  return mediaId
}

/** Cria o container de mídia (REELS) e retorna o containerId. */
export async function criarContainerReel(params: {
  accessToken: string
  igUserId: string
  videoUrl: string
  legenda: string
}): Promise<string> {
  const criar = await fbFetch(`${BASE}/${params.igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: params.videoUrl,
      caption: params.legenda,
      access_token: params.accessToken,
    }),
  })
  const containerId = criar.id as string | undefined
  if (!containerId) throw new Error('Instagram não retornou o ID do container de mídia')
  return containerId
}

/** Consulta o status de processamento de um container (FINISHED/IN_PROGRESS/ERROR). */
export async function statusContainer(params: {
  accessToken: string
  containerId: string
}): Promise<string> {
  const data = await fbFetch(
    `${BASE}/${params.containerId}?fields=status_code&access_token=${encodeURIComponent(params.accessToken)}`
  )
  return (data.status_code as string) || 'IN_PROGRESS'
}

/** Publica um container já processado (FINISHED). Retorna o ID da mídia. */
export async function publicarContainer(params: {
  accessToken: string
  igUserId: string
  containerId: string
}): Promise<string> {
  const publicar = await fbFetch(`${BASE}/${params.igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: params.containerId,
      access_token: params.accessToken,
    }),
  })
  const mediaId = publicar.id as string | undefined
  if (!mediaId) throw new Error('Instagram não retornou o ID da publicação')
  return mediaId
}

/** Monta a legenda final: texto + chamada para ação + link de compra + hashtags. */
export function montarLegenda(
  legendaInstagram?: string | null,
  hashtags?: string[],
  chamadaAcao?: string | null,
  linkCompra?: string | null
): string {
  return [
    legendaInstagram?.trim(),
    chamadaAcao?.trim(),
    linkCompra ? `🛒 Compre aqui: ${linkCompra}` : '',
    (hashtags ?? []).join(' ').trim(),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Renova um token de longa duração do Instagram usando o grant fb_exchange_token.
 * Retorna o novo token e quantos segundos até expirar (~5184000 = 60 dias).
 */
export async function renovarTokenInstagram(params: {
  accessToken: string
  appId?: string
  appSecret?: string
}): Promise<{ accessToken: string; expiresIn: number }> {
  // Instagram Login API: renova o token de longa duração via ig_refresh_token.
  // Não precisa de appId/appSecret — basta o token atual (válido, com +24h de vida).
  const url =
    `https://graph.instagram.com/refresh_access_token` +
    `?grant_type=ig_refresh_token` +
    `&access_token=${encodeURIComponent(params.accessToken)}`

  const data = await fbFetch(url)

  if (!data.access_token) {
    throw new Error('Instagram não retornou um novo access_token na renovação')
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: (data.expires_in as number) ?? 5184000,
  }
}
