import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consultarStatusVideo, obterResultadoVideo, SubmeterResultado } from '@/lib/falai'
import { consultarStatusRunway } from '@/lib/runway'
import { concatVideos } from '@/lib/concat-video'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)

async function salvarVideoSupabase(videoUrl: string, userId: string, sufixo: string): Promise<string> {
  const resp = await fetch(videoUrl)
  if (!resp.ok) throw new Error(`Não consegui baixar o vídeo gerado (HTTP ${resp.status})`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const storagePath = `${userId}/${Date.now()}-${sufixo}.mp4`
  const { data: up, error: upErr } = await supabaseAdmin.storage
    .from('videos')
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: false })
  if (upErr) throw new Error(`Upload no Supabase falhou: ${upErr.message}`)
  const { data: urlData } = supabaseAdmin.storage.from('videos').getPublicUrl(up.path)
  return urlData.publicUrl
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }

  if (conteudo.videoUrl) {
    return NextResponse.json({ status: 'pronto', videoUrl: conteudo.videoUrl })
  }
  if (!conteudo.videoRequestId) {
    return NextResponse.json({ status: 'nenhum', erro: conteudo.videoErro })
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(conteudo.videoRequestId) as Record<string, unknown>
  } catch {
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoRequestId: null, videoErro: 'Job de vídeo em formato inválido — gere novamente.' },
    })
    return NextResponse.json({ status: 'erro', erro: 'Formato inválido. Tente gerar de novo.' }, { status: 502 })
  }

  try {
    // ---- RunwayML ----
    if (parsed.provider === 'runway') {
      const taskId = parsed.taskId as string
      const { status, videoUrl: rwVideoUrl, erro } = await consultarStatusRunway(taskId)

      if (status === 'PENDING' || status === 'RUNNING' || status === 'THROTTLED') {
        return NextResponse.json({ status: 'gerando' })
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        const msg = erro || `Geração falhou no RunwayML (${status})`
        await prisma.conteudo.update({
          where: { id: conteudo.id },
          data: { videoRequestId: null, videoErro: msg },
        })
        return NextResponse.json({ status: 'erro', erro: msg }, { status: 502 })
      }

      // SUCCEEDED
      if (!rwVideoUrl) throw new Error('RunwayML não retornou URL do vídeo')
      const videoUrlPublica = await salvarVideoSupabase(rwVideoUrl, session.user.id, 'runway')
      const atualizado = await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoUrl: videoUrlPublica, videoRequestId: null, videoErro: null },
      })
      return NextResponse.json({ status: 'pronto', videoUrl: atualizado.videoUrl })
    }

    // ---- fal.ai v2: múltiplos clipes ----
    if (parsed.v === 2) {
      const clips = parsed.clips as SubmeterResultado[]
      const statuses = await Promise.all(clips.map((c) => consultarStatusVideo(c.statusUrl)))

      if (statuses.some((s) => s.status === 'IN_QUEUE' || s.status === 'IN_PROGRESS')) {
        return NextResponse.json({ status: 'gerando' })
      }
      if (statuses.some((s) => s.status === 'FAILED')) {
        await prisma.conteudo.update({
          where: { id: conteudo.id },
          data: { videoRequestId: null, videoErro: 'Geração de vídeo falhou no fal.ai' },
        })
        return NextResponse.json({ status: 'erro', erro: 'Um dos clipes falhou no fal.ai' }, { status: 502 })
      }

      const resultados = await Promise.all(clips.map((c) => obterResultadoVideo(c.resultUrl)))
      const clipUrls = resultados.map((r) => r.videoUrl)
      const buffer = await concatVideos(clipUrls)

      const storagePath = `${session.user.id}/${Date.now()}-fal.mp4`
      const { data: up, error: upErr } = await supabaseAdmin.storage
        .from('videos')
        .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: false })
      if (upErr) throw new Error(`Upload no Supabase falhou: ${upErr.message}`)

      const { data: urlData } = supabaseAdmin.storage.from('videos').getPublicUrl(up.path)
      const atualizado = await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoUrl: urlData.publicUrl, videoRequestId: null, videoErro: null },
      })
      return NextResponse.json({ status: 'pronto', videoUrl: atualizado.videoUrl })
    }

    // ---- fal.ai v1: clipe único ----
    const statusUrl = parsed.statusUrl as string | undefined
    const resultUrl = parsed.resultUrl as string | undefined
    if (!statusUrl || !resultUrl) {
      return NextResponse.json({ status: 'erro', erro: 'URLs do fal.ai ausentes' }, { status: 502 })
    }

    const { status } = await consultarStatusVideo(statusUrl)

    if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
      return NextResponse.json({ status: 'gerando' })
    }
    if (status === 'FAILED') {
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoRequestId: null, videoErro: 'Geração de vídeo falhou no fal.ai' },
      })
      return NextResponse.json({ status: 'erro', erro: 'Falhou no fal.ai' }, { status: 502 })
    }

    const { videoUrl: falVideoUrl } = await obterResultadoVideo(resultUrl)
    const videoUrlPublica = await salvarVideoSupabase(falVideoUrl, session.user.id, 'fal')
    const atualizado = await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoUrl: videoUrlPublica, videoRequestId: null, videoErro: null },
    })
    return NextResponse.json({ status: 'pronto', videoUrl: atualizado.videoUrl })

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao consultar status do vídeo'
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoErro: msg },
    })
    return NextResponse.json({ status: 'erro', erro: msg }, { status: 502 })
  }
}
