// Integração com o fal.ai para geração de vídeo a partir de imagem.
// Documentação: https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api

const FAL_BASE = 'https://queue.fal.run'

// ── Registro de motores de vídeo ──────────────────────────────────────
// Cada motor é um modelo image-to-video no fal.ai (mesma FAL_KEY). O corpo
// da requisição varia por modelo, então cada um monta o seu.
export type MotorVideo = 'kling' | 'veo'

export interface SubmeterVideoParams {
  imageUrl: string
  prompt: string
  duracaoSegundos?: number // Kling: 5/10/15. Veo 3: ~8s fixo (ignora).
}

interface ModeloConfig {
  path: string
  label: string
  // Se true, gera um único clipe (sem composição de vários clipes).
  clipeUnico: boolean
  montarBody: (p: SubmeterVideoParams) => Record<string, unknown>
}

export const MOTORES_VIDEO: Record<MotorVideo, ModeloConfig> = {
  kling: {
    path: 'fal-ai/kling-video/v3/pro/image-to-video',
    label: 'Kling v3 Pro',
    clipeUnico: false,
    montarBody: (p) => ({
      image_url: p.imageUrl,
      prompt: p.prompt,
      duration: p.duracaoSegundos ?? 10,
    }),
  },
  veo: {
    // Google Veo 3 (image-to-video) via fal.ai. Gera ~8s com áudio.
    // OBS: endpoint/parâmetros exatos precisam de validação contra o fal.ai
    // (não dá pra testar deste ambiente). Isolado aqui pra correção fácil.
    path: 'fal-ai/veo3/image-to-video',
    label: 'Google Veo 3',
    clipeUnico: true,
    montarBody: (p) => ({
      image_url: p.imageUrl,
      prompt: p.prompt,
      duration: '8s',
      generate_audio: true,
    }),
  },
}

export interface SubmeterResultado {
  requestId: string
  statusUrl: string
  resultUrl: string
}

export type StatusFal = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'

export interface StatusResultado {
  status: StatusFal
  logs?: Array<{ message: string; level?: string }>
}

export interface VideoPronto {
  videoUrl: string
}

function headers(): HeadersInit {
  const key = process.env.FAL_KEY
  if (!key) throw new Error('FAL_KEY não configurada. Adicione em Settings → Environment Variables.')
  return {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  }
}

async function falFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
  // Tenta ler como JSON; se falhar, captura o texto para diagnóstico.
  const textBody = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = textBody ? JSON.parse(textBody) : {}
  } catch {
    // não é JSON
  }
  if (!res.ok) {
    // fal.ai retorna erros de validação como array (formato pydantic)
    let detail: string
    if (Array.isArray(data?.detail)) {
      const primeiro = (data.detail as Array<{ type?: string; msg?: string }>)[0]
      if (primeiro?.type === 'content_policy_violation') {
        detail =
          'A imagem do produto foi bloqueada pela moderação do fal.ai. ' +
          'Tente usar uma imagem diferente, com fundo neutro e sem texto sobreposto.'
      } else {
        detail = primeiro?.msg || JSON.stringify(data.detail).slice(0, 200)
      }
    } else {
      const raw =
        (data?.detail as string) ||
        (data?.error as string) ||
        (data?.message as string) ||
        textBody.slice(0, 300)
      if (typeof raw === 'string' && raw.toLowerCase().includes('exhausted balance')) {
        detail =
          'Saldo esgotado no fal.ai. Recarregue em fal.ai/dashboard/billing e tente novamente.'
      } else if (typeof raw === 'string' && raw.toLowerCase().includes('user is locked')) {
        detail =
          'Conta fal.ai bloqueada por saldo insuficiente. Acesse fal.ai/dashboard/billing para recarregar.'
      } else {
        detail = typeof raw === 'string' ? raw : JSON.stringify(raw).slice(0, 200)
      }
    }
    // Para 405 Method Not Allowed, inclui o header Allow (diz quais métodos a URL aceita)
    const allowHeader = res.headers.get('allow')
    const contextoExtra = [
      res.status === 405 && allowHeader ? `Allow: ${allowHeader}` : '',
      `URL: ${url}`,
    ].filter(Boolean).join(' · ')
    const msg = detail || `Erro HTTP ${res.status} (${res.statusText || 'sem texto'}) no fal.ai · ${contextoExtra}`
    // Log no servidor para diagnóstico
    const headersDump: Record<string, string> = {}
    res.headers.forEach((v, k) => { headersDump[k] = v })
    console.error('[falai] erro:', {
      status: res.status,
      statusText: res.statusText,
      url,
      body: textBody.slice(0, 500),
      headers: headersDump,
    })
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

/** Envia o job de geração de vídeo. Retorna o requestId e as URLs de
 * status/resultado fornecidas pelo próprio fal.ai (o caminho varia por
 * modelo, então é mais seguro usar as URLs que ele devolve). */
export async function submeterGeracaoVideo(
  params: SubmeterVideoParams,
  motor: MotorVideo = 'kling'
): Promise<SubmeterResultado> {
  const modelo = MOTORES_VIDEO[motor] ?? MOTORES_VIDEO.kling
  const body = modelo.montarBody(params)
  const data = await falFetch(`${FAL_BASE}/${modelo.path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const requestId = data.request_id as string | undefined
  const statusUrl = data.status_url as string | undefined
  const resultUrl = data.response_url as string | undefined
  if (!requestId || !statusUrl || !resultUrl) {
    throw new Error('fal.ai não retornou request_id / status_url / response_url')
  }
  return { requestId, statusUrl, resultUrl }
}

/** Submete múltiplos jobs em paralelo e retorna um array de resultados. */
export async function submeterMultiplosClipes(
  params: SubmeterVideoParams,
  quantidade: number,
  motor: MotorVideo = 'kling'
): Promise<SubmeterResultado[]> {
  return Promise.all(
    Array.from({ length: quantidade }, () => submeterGeracaoVideo(params, motor))
  )
}

/** Consulta o status do job pela URL fornecida pelo fal.ai no submit. */
export async function consultarStatusVideo(statusUrl: string): Promise<StatusResultado> {
  const data = await falFetch(statusUrl)
  return {
    status: data.status as StatusFal,
    logs: data.logs as StatusResultado['logs'],
  }
}

/** Busca o resultado de um job já concluído (COMPLETED) pela URL do fal.ai. */
export async function obterResultadoVideo(resultUrl: string): Promise<VideoPronto> {
  const data = await falFetch(resultUrl)
  const video = (data as { video?: { url?: string } }).video
  const videoUrl = video?.url
  if (!videoUrl) throw new Error('fal.ai não retornou URL do vídeo')
  return { videoUrl }
}

/** ── Composição de múltiplos vídeos via fal-ai/ffmpeg-api/compose ── */
const COMPOSE_PATH = 'fal-ai/ffmpeg-api/compose'

export async function comporVideos(
  videosUrls: string[]
): Promise<SubmeterResultado> {
  // Monta uma track por vídeo, cada um começando logo após o anterior.
  // Assumimos que cada clipe Kling tem ~15s; pra ser preciso poderíamos
  // ler a duração real, mas o ffmpeg corta no mínimo entre duração
  // declarada e duração real do arquivo.
  const DURACAO_CLIPE_MS = 15000
  const tracks = videosUrls.map((url, i) => ({
    id: `video${i + 1}`,
    type: 'video',
    keyframes: [
      {
        timestamp: i * DURACAO_CLIPE_MS,
        duration: DURACAO_CLIPE_MS,
        url,
      },
    ],
  }))

  const data = await falFetch(`${FAL_BASE}/${COMPOSE_PATH}`, {
    method: 'POST',
    body: JSON.stringify({ tracks }),
  })

  const requestId = data.request_id as string | undefined
  const statusUrl = data.status_url as string | undefined
  const resultUrl = data.response_url as string | undefined
  if (!requestId || !statusUrl || !resultUrl) {
    throw new Error('fal.ai compose não retornou as URLs esperadas')
  }
  return { requestId, statusUrl, resultUrl }
}

/** Consulta status da composição (mesmo formato do Kling). */
export async function consultarStatusCompose(
  statusUrl: string
): Promise<StatusResultado> {
  return consultarStatusVideo(statusUrl)
}

/** Obtém URL do vídeo composto (formato diferente do Kling: usa video_url direto). */
export async function obterResultadoCompose(
  resultUrl: string
): Promise<VideoPronto> {
  const data = await falFetch(resultUrl)
  const videoUrl = (data as { video_url?: string }).video_url
  if (!videoUrl) throw new Error('fal.ai compose não retornou video_url')
  return { videoUrl }
}

/** ── Legendas estilo CapCut via veed/subtitles ── */
const VEED_PATH = 'veed/subtitles'

export interface AdicionarLegendaParams {
  videoUrl: string
  srtContent: string
  preset?: string // 'glass', 'whisper', 'simple', etc. Default 'glass'
}

export async function adicionarLegendaVideo(
  params: AdicionarLegendaParams
): Promise<SubmeterResultado> {
  const body = {
    video_url: params.videoUrl,
    preset: params.preset ?? 'glass',
    srt_content: params.srtContent,
  }
  const data = await falFetch(`${FAL_BASE}/${VEED_PATH}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const requestId = data.request_id as string | undefined
  const statusUrl = data.status_url as string | undefined
  const resultUrl = data.response_url as string | undefined
  if (!requestId || !statusUrl || !resultUrl) {
    throw new Error('veed/subtitles não retornou as URLs esperadas')
  }
  return { requestId, statusUrl, resultUrl }
}

/** Obtém o vídeo legendado pronto. veed pode usar video.url OU video_url. */
export async function obterResultadoLegenda(resultUrl: string): Promise<VideoPronto> {
  const data = await falFetch(resultUrl)
  const v1 = (data as { video?: { url?: string } }).video
  const v2 = (data as { video_url?: string }).video_url
  const videoUrl = v1?.url ?? v2
  if (!videoUrl) throw new Error('veed/subtitles não retornou URL do vídeo')
  return { videoUrl }
}

function formatarTempoSrt(segundos: number): string {
  const ms = Math.max(0, Math.floor(segundos * 1000))
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const milli = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`
}

/** Gera um SRT a partir de um texto, dividindo em pedaços por pontuação
 * e distribuindo no tempo total do vídeo. */
export function montarSrt(texto: string, duracaoSegundos: number): string {
  const limpo = texto.trim()
  if (!limpo) return ''
  const total = duracaoSegundos > 0 ? duracaoSegundos : 10

  // Divide por pontuação final (.!?) mantendo pelo menos um pedaço
  const partes = limpo
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (partes.length <= 1) {
    return `1\n${formatarTempoSrt(0)} --> ${formatarTempoSrt(total)}\n${limpo}\n`
  }

  const duracaoPorParte = total / partes.length
  let srt = ''
  partes.forEach((parte, i) => {
    const inicio = i * duracaoPorParte
    const fim = Math.min(total, (i + 1) * duracaoPorParte)
    srt += `${i + 1}\n${formatarTempoSrt(inicio)} --> ${formatarTempoSrt(fim)}\n${parte}\n\n`
  })
  return srt
}
