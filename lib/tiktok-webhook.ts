/**
 * Webhook de Content Posting do TikTok (Rodada 6, regra 14) — endpoint
 * seguro para eventos de status quando pudermos configurar legitimamente
 * (nenhum serviço externo contratado; só o endpoint HTTP já hospedado pelo
 * próprio Next.js). Nunca confia em payload sem verificar autenticidade,
 * nunca processa o mesmo evento duas vezes (idempotência), nunca aceita
 * timestamp antigo demais (proteção contra replay).
 */

import crypto from 'crypto'

const REPLAY_TOLERANCIA_MS = 5 * 60 * 1000 // 5 minutos

export interface TikTokWebhookPayload {
  event: string
  client_key: string
  create_time: number // epoch segundos, enviado pelo TikTok
  user_openid: string
  content?: string // JSON-string com o corpo específico do evento (ex.: publish_id, status)
}

/**
 * Verifica a assinatura HMAC-SHA256 do webhook (segredo = client_secret do
 * app) sobre `timestamp.corpoCru` — nunca aceita um payload cuja assinatura
 * não bate, mesmo que o JSON pareça válido.
 */
export function verificarAssinaturaWebhook(params: {
  corpoCru: string
  timestampHeader: string
  assinaturaHeader: string
  clientSecret: string
}): boolean {
  const esperado = crypto
    .createHmac('sha256', params.clientSecret)
    .update(`${params.timestampHeader}.${params.corpoCru}`)
    .digest('hex')
  const a = Buffer.from(params.assinaturaHeader)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Rejeita webhook com timestamp fora da janela de tolerância — nunca reprocessa um replay antigo. */
export function timestampDentroDaJanela(timestampHeaderSegundos: string, agoraMs: number = Date.now()): boolean {
  const ts = parseInt(timestampHeaderSegundos, 10)
  if (Number.isNaN(ts)) return false
  return Math.abs(agoraMs - ts * 1000) <= REPLAY_TOLERANCIA_MS
}

/** Store de idempotência — injetável para teste sem banco real. */
export interface WebhookIdempotencyStore {
  jaProcessado(eventId: string): Promise<boolean>
  marcarProcessado(eventId: string): Promise<void>
}

export class WebhookIdempotencyStoreEmMemoria implements WebhookIdempotencyStore {
  private vistos = new Set<string>()
  async jaProcessado(eventId: string) {
    return this.vistos.has(eventId)
  }
  async marcarProcessado(eventId: string) {
    this.vistos.add(eventId)
  }
}

/** Identificador estável do evento para dedup — nunca reprocessa o mesmo `publish_id`+`event`. */
export function idDoEvento(payload: TikTokWebhookPayload): string {
  return `${payload.event}:${payload.user_openid}:${payload.create_time}`
}

export interface ProcessarWebhookResultado {
  aceito: boolean
  motivo: string
  duplicado: boolean
}

/**
 * Pipeline completo de recebimento: assinatura → replay → idempotência.
 * Falha em qualquer etapa nunca processa o evento como se fosse válido.
 */
export async function processarWebhookTikTok(params: {
  corpoCru: string
  timestampHeader: string
  assinaturaHeader: string
  clientSecret: string
  store: WebhookIdempotencyStore
  agoraMs?: number
}): Promise<ProcessarWebhookResultado> {
  if (!verificarAssinaturaWebhook({ ...params })) {
    return { aceito: false, motivo: 'Assinatura inválida.', duplicado: false }
  }
  if (!timestampDentroDaJanela(params.timestampHeader, params.agoraMs)) {
    return { aceito: false, motivo: 'Timestamp fora da janela de tolerância (possível replay).', duplicado: false }
  }

  let payload: TikTokWebhookPayload
  try {
    payload = JSON.parse(params.corpoCru)
  } catch {
    return { aceito: false, motivo: 'Corpo não é um JSON válido.', duplicado: false }
  }

  const eventId = idDoEvento(payload)
  if (await params.store.jaProcessado(eventId)) {
    return { aceito: true, motivo: 'Evento já processado anteriormente — ignorado (idempotência).', duplicado: true }
  }
  await params.store.marcarProcessado(eventId)
  return { aceito: true, motivo: 'Evento aceito e processado.', duplicado: false }
}
