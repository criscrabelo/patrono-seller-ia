// Integração com Z-API para envio de mensagens WhatsApp em massa.
// Docs: https://developer.z-api.io

export interface ZApiConfig {
  instanceId: string
  token: string
  clientToken?: string // security token opcional do Z-API
}

export interface EnvioTexto {
  numero: string  // formato: 5511999999999 (sem + ou espaços)
  mensagem: string
}

export interface EnvioImagem {
  numero: string
  imageUrl: string
  legenda?: string
}

export interface ResultadoEnvio {
  numero: string
  ok: boolean
  erro?: string
}

function zapiBase(cfg: ZApiConfig) {
  return `https://api.z-api.io/instances/${cfg.instanceId}/token/${cfg.token}`
}

function zapiHeaders(cfg: ZApiConfig): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (cfg.clientToken) h['client-token'] = cfg.clientToken
  return h
}

/** Normaliza número: remove tudo que não é dígito e garante código do país */
export function normalizarNumero(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // Aceita 10-13 dígitos
  if (digits.length < 10 || digits.length > 13) return null
  // Se não começar com 55 (Brasil), adiciona
  if (!digits.startsWith('55')) return '55' + digits
  return digits
}

/** Verifica se a instância está conectada */
export async function verificarConexao(cfg: ZApiConfig): Promise<{ conectado: boolean; numero?: string }> {
  const res = await fetch(`${zapiBase(cfg)}/status`, { headers: zapiHeaders(cfg) })
  if (!res.ok) return { conectado: false }
  const data = await res.json() as Record<string, unknown>
  // Z-API retorna { connected: true, smartphoneConnected: true, ... }
  const conectado = !!(data.connected || data.smartphoneConnected)
  return { conectado, numero: data.phone as string | undefined }
}

/** Envia mensagem de texto para um número */
export async function enviarTexto(cfg: ZApiConfig, params: EnvioTexto): Promise<ResultadoEnvio> {
  const numero = normalizarNumero(params.numero)
  if (!numero) return { numero: params.numero, ok: false, erro: 'Número inválido' }
  try {
    const res = await fetch(`${zapiBase(cfg)}/send-text`, {
      method: 'POST',
      headers: zapiHeaders(cfg),
      body: JSON.stringify({ phone: numero, message: params.mensagem }),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      return { numero, ok: false, erro: (data.error as string) || `HTTP ${res.status}` }
    }
    return { numero, ok: true }
  } catch (e) {
    return { numero, ok: false, erro: e instanceof Error ? e.message : 'Erro de conexão' }
  }
}

/** Envia imagem com legenda para um número */
export async function enviarImagem(cfg: ZApiConfig, params: EnvioImagem): Promise<ResultadoEnvio> {
  const numero = normalizarNumero(params.numero)
  if (!numero) return { numero: params.numero, ok: false, erro: 'Número inválido' }
  try {
    const res = await fetch(`${zapiBase(cfg)}/send-image`, {
      method: 'POST',
      headers: zapiHeaders(cfg),
      body: JSON.stringify({
        phone: numero,
        image: params.imageUrl,
        caption: params.legenda ?? '',
      }),
    })
    const data = await res.json() as Record<string, unknown>
    if (!res.ok) {
      return { numero, ok: false, erro: (data.error as string) || `HTTP ${res.status}` }
    }
    return { numero, ok: true }
  } catch (e) {
    return { numero, ok: false, erro: e instanceof Error ? e.message : 'Erro de conexão' }
  }
}

/** Envia em lote com delay entre mensagens para evitar ban */
export async function enviarEmMassa(
  cfg: ZApiConfig,
  numeros: string[],
  mensagem: string,
  imagemUrl?: string,
  onProgresso?: (atual: number, total: number, resultado: ResultadoEnvio) => void,
  delayMs = 3000
): Promise<ResultadoEnvio[]> {
  const resultados: ResultadoEnvio[] = []
  for (let i = 0; i < numeros.length; i++) {
    const numero = numeros[i]
    const resultado = imagemUrl
      ? await enviarImagem(cfg, { numero, imageUrl: imagemUrl, legenda: mensagem })
      : await enviarTexto(cfg, { numero, mensagem })
    resultados.push(resultado)
    onProgresso?.(i + 1, numeros.length, resultado)
    // Delay entre envios para não ser banido pelo WhatsApp
    if (i < numeros.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return resultados
}
