// Integração com o fal.ai para geração de vídeo a partir de imagem.
// Documentação: https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api

const FAL_BASE = 'https://queue.fal.run'
const MODEL_PATH = 'fal-ai/kling-video/v3/pro/image-to-video'

export interface SubmeterVideoParams {
  imageUrl: string
  prompt: string
  duracaoSegundos?: number // 3-15, default 5
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
    const detail =
      (data?.detail as string) ||
      (data?.error as string) ||
      (data?.message as string) ||
      textBody.slice(0, 200)
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
  params: SubmeterVideoParams
): Promise<SubmeterResultado> {
  const body = {
    start_image_url: params.imageUrl,
    prompt: params.prompt,
    duration: params.duracaoSegundos ?? 5,
  }
  const data = await falFetch(`${FAL_BASE}/${MODEL_PATH}`, {
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
