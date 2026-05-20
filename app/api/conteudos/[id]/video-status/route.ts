import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consultarStatusVideo, obterResultadoVideo } from '@/lib/falai'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)

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

  // Já tem vídeo pronto → nada a fazer.
  if (conteudo.videoUrl) {
    return NextResponse.json({ status: 'pronto', videoUrl: conteudo.videoUrl })
  }
  // Sem job em andamento.
  if (!conteudo.videoRequestId || !conteudo.videoStatusUrl || !conteudo.videoResultUrl) {
    return NextResponse.json({ status: 'nenhum', erro: conteudo.videoErro })
  }

  try {
    const { status } = await consultarStatusVideo(conteudo.videoStatusUrl)

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

    // COMPLETED → busca a URL, baixa o vídeo e salva no Supabase.
    const { videoUrl: falVideoUrl } = await obterResultadoVideo(conteudo.videoResultUrl)

    const videoResp = await fetch(falVideoUrl)
    if (!videoResp.ok) {
      throw new Error(`Não consegui baixar o vídeo do fal.ai (HTTP ${videoResp.status})`)
    }
    const buffer = Buffer.from(await videoResp.arrayBuffer())
    const path = `${session.user.id}/${Date.now()}-fal.mp4`
    const { data: up, error: upErr } = await supabaseAdmin.storage
      .from('videos')
      .upload(path, buffer, { contentType: 'video/mp4', upsert: false })
    if (upErr) throw new Error(`Upload no Supabase falhou: ${upErr.message}`)

    const { data: urlData } = supabaseAdmin.storage.from('videos').getPublicUrl(up.path)
    const videoUrlPublica = urlData.publicUrl

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
