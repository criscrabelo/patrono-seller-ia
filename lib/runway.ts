// Integração com RunwayML Gen-4 Turbo para geração de vídeo a partir de imagem.
// Documentação: https://docs.dev.runwayml.com/

const BASE = 'https://api.runwayml.com/v1'

export type RunwayStatus = 'PENDING' | 'RUNNING' | 'THROTTLED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

function headers(): HeadersInit {
  const key = process.env.RUNWAYML_API_SECRET
  if (!key) throw new Error('RUNWAYML_API_SECRET não configurada. Adicione em Settings → Environment Variables.')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  }
}

async function runwayFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try { data = text ? JSON.parse(text) : {} } catch { /* não é JSON */ }
  if (!res.ok) {
    const msg =
      (data?.message as string) ||
      (data?.error as string) ||
      text.slice(0, 200)
    console.error('[runway] erro:', { status: res.status, url, body: text.slice(0, 400) })
    throw new Error(msg || `Erro HTTP ${res.status} no RunwayML`)
  }
  return data
}

/** Submete um job de geração de vídeo a partir de imagem. Retorna o taskId. */
export async function submeterGeracaoVideoRunway(params: {
  imageUrl: string
  prompt: string
  duracaoSegundos?: 5 | 10
}): Promise<{ taskId: string }> {
  const data = await runwayFetch(`${BASE}/image_to_video`, {
    method: 'POST',
    body: JSON.stringify({
      model: 'gen4_turbo',
      promptImage: params.imageUrl,
      promptText: params.prompt,
      duration: params.duracaoSegundos ?? 10,
      ratio: '768:1280', // 9:16 — formato ideal para Reels/TikTok
    }),
  })
  const taskId = data.id as string | undefined
  if (!taskId) throw new Error('RunwayML não retornou ID da tarefa')
  return { taskId }
}

/** Consulta o status de um job pelo taskId. */
export async function consultarStatusRunway(taskId: string): Promise<{
  status: RunwayStatus
  videoUrl?: string
  erro?: string
}> {
  const data = await runwayFetch(`${BASE}/tasks/${taskId}`)
  const status = data.status as RunwayStatus
  const output = data.output as string[] | undefined
  const videoUrl = output?.[0]
  const erro = (data.failure as string) || (data.failureCode as string) || undefined
  return { status, videoUrl, erro }
}
