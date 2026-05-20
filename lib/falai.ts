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
    const msg =
      (data?.detail as string) ||
      (data?.error as string) ||
      (data?.message as string) ||
      textBody.slice(0, 200) ||
      `Erro HTTP ${res.status} no fal.ai`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

/** Envia o job de geração de vídeo. Retorna o requestId para acompanhar. */
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
  if (!requestId) throw new Error('fal.ai não retornou request_id')
  return { requestId }
}

/** Consulta o status do job. */
export async function consultarStatusVideo(requestId: string): Promise<StatusResultado> {
  const data = await falFetch(
    `${FAL_BASE}/${MODEL_PATH}/requests/${encodeURIComponent(requestId)}/status`
  )
  return {
    status: data.status as StatusFal,
    logs: data.logs as StatusResultado['logs'],
  }
}

/** Busca o resultado de um job já concluído (COMPLETED). */
export async function obterResultadoVideo(requestId: string): Promise<VideoPronto> {
  const data = await falFetch(
    `${FAL_BASE}/${MODEL_PATH}/requests/${encodeURIComponent(requestId)}`
  )
  const videoUrl = data?.video?.url as string | undefined
  if (!videoUrl) throw new Error('fal.ai não retornou URL do vídeo')
  return { videoUrl }
}
