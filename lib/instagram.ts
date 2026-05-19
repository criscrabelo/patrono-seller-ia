// Publicação de Reels no Instagram via Instagram Graph API (Meta).
// Requer um Access Token e o ID da conta comercial do Instagram,
// configurados na página de Integrações.

const API_VERSION = 'v21.0'
const BASE = `https://graph.facebook.com/${API_VERSION}`

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

/** Monta a legenda final juntando o texto do Instagram com as hashtags. */
export function montarLegenda(legendaInstagram?: string | null, hashtags?: string[]): string {
  return [legendaInstagram?.trim(), (hashtags ?? []).join(' ').trim()]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Renova um token de longa duração do Instagram usando o grant fb_exchange_token.
 * Retorna o novo token e quantos segundos até expirar (~5184000 = 60 dias).
 */
export async function renovarTokenInstagram(params: {
  accessToken: string
  appId: string
  appSecret: string
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url =
    `${BASE}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(params.appId)}` +
    `&client_secret=${encodeURIComponent(params.appSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(params.accessToken)}`

  const data = await fbFetch(url)

  if (!data.access_token) {
    throw new Error('Meta não retornou um novo access_token na renovação')
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: (data.expires_in as number) ?? 5183944,
  }
}
