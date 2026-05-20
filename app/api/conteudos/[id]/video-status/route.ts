import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  consultarStatusVideo,
  obterResultadoVideo,
  comporVideos,
  consultarStatusCompose,
  obterResultadoCompose,
} from '@/lib/falai'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)

interface ClipeEstado {
  requestId: string
  statusUrl: string
  resultUrl: string
  videoUrl: string | null
}

interface EstadoVideo {
  fase: 'gerando_clipes' | 'compondo'
  duracaoTotal?: number
  clipes: ClipeEstado[]
  compose: null | { requestId: string; statusUrl: string; resultUrl: string }
}

async function baixarUploadParaSupabase(videoUrlFal: string, userId: string): Promise<string> {
  const videoResp = await fetch(videoUrlFal)
  if (!videoResp.ok) {
    throw new Error(`Não consegui baixar o vídeo do fal.ai (HTTP ${videoResp.status})`)
  }
  const buffer = Buffer.from(await videoResp.arrayBuffer())
  const path = `${userId}/${Date.now()}-fal.mp4`
  const { data: up, error: upErr } = await supabaseAdmin.storage
    .from('videos')
    .upload(path, buffer, { contentType: 'video/mp4', upsert: false })
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
  if (!conteudo) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })

  if (conteudo.videoUrl) {
    return NextResponse.json({ status: 'pronto', videoUrl: conteudo.videoUrl })
  }
  if (!conteudo.videoRequestId) {
    return NextResponse.json({ status: 'nenhum', erro: conteudo.videoErro })
  }

  // Tenta interpretar o videoRequestId como nosso estado JSON.
  let estado: EstadoVideo
  try {
    estado = JSON.parse(conteudo.videoRequestId) as EstadoVideo
    if (!estado.clipes || !Array.isArray(estado.clipes)) throw new Error('formato inválido')
  } catch {
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoRequestId: null, videoErro: 'Job em formato antigo — gere novamente.' },
    })
    return NextResponse.json(
      { status: 'erro', erro: 'Formato antigo. Tente gerar de novo.' },
      { status: 502 }
    )
  }

  try {
    // ─── FASE 1: gerando_clipes ──────────────────────────────────────
    if (estado.fase === 'gerando_clipes') {
      let mudouEstado = false
      let todosProntos = true

      for (const clipe of estado.clipes) {
        if (clipe.videoUrl) continue // já está pronto
        const { status } = await consultarStatusVideo(clipe.statusUrl)
        if (status === 'COMPLETED') {
          const { videoUrl } = await obterResultadoVideo(clipe.resultUrl)
          clipe.videoUrl = videoUrl
          mudouEstado = true
        } else if (status === 'FAILED') {
          throw new Error('Um dos clipes falhou no fal.ai')
        } else {
          todosProntos = false
        }
      }

      if (!todosProntos) {
        if (mudouEstado) {
          await prisma.conteudo.update({
            where: { id: conteudo.id },
            data: { videoRequestId: JSON.stringify(estado) },
          })
        }
        return NextResponse.json({ status: 'gerando', fase: 'gerando_clipes' })
      }

      // Todos os clipes prontos!
      if (estado.clipes.length === 1) {
        // Clipe único — pula composição, baixa e salva
        const videoUrlClipe = estado.clipes[0].videoUrl
        if (!videoUrlClipe) throw new Error('Clipe sem URL após COMPLETED')
        const urlFinal = await baixarUploadParaSupabase(videoUrlClipe, session.user.id)
        await prisma.conteudo.update({
          where: { id: conteudo.id },
          data: { videoUrl: urlFinal, videoRequestId: null, videoErro: null },
        })
        return NextResponse.json({ status: 'pronto', videoUrl: urlFinal })
      }

      // Múltiplos clipes — submete composição
      const urlsClipes = estado.clipes.map((c) => c.videoUrl).filter((u): u is string => !!u)
      const composeJob = await comporVideos(urlsClipes)
      estado.fase = 'compondo'
      estado.compose = composeJob
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoRequestId: JSON.stringify(estado) },
      })
      return NextResponse.json({ status: 'gerando', fase: 'compondo' })
    }

    // ─── FASE 2: compondo ────────────────────────────────────────────
    if (estado.fase === 'compondo' && estado.compose) {
      const { status } = await consultarStatusCompose(estado.compose.statusUrl)
      if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
        return NextResponse.json({ status: 'gerando', fase: 'compondo' })
      }
      if (status === 'FAILED') {
        throw new Error('Composição dos vídeos falhou no fal.ai')
      }
      // COMPLETED → busca a URL composta, baixa, sobe pro Supabase
      const { videoUrl: composedUrl } = await obterResultadoCompose(estado.compose.resultUrl)
      const urlFinal = await baixarUploadParaSupabase(composedUrl, session.user.id)
      await prisma.conteudo.update({
        where: { id: conteudo.id },
        data: { videoUrl: urlFinal, videoRequestId: null, videoErro: null },
      })
      return NextResponse.json({ status: 'pronto', videoUrl: urlFinal })
    }

    return NextResponse.json({ status: 'erro', erro: 'Estado desconhecido' }, { status: 500 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao consultar status do vídeo'
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoErro: msg, videoRequestId: null },
    })
    return NextResponse.json({ status: 'erro', erro: msg }, { status: 502 })
  }
}
