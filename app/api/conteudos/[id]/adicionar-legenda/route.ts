import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  adicionarLegendaVideo,
  consultarStatusVideo,
  obterResultadoLegenda,
  montarSrt,
  BloqueadoPorPoliticaDeCusto,
} from '@/lib/falai'
import { createClient } from '@supabase/supabase-js'

// Processar legendas pode levar ~30-60s.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
)

async function baixarUploadParaSupabase(urlFal: string, userId: string): Promise<string> {
  const resp = await fetch(urlFal)
  if (!resp.ok) throw new Error(`Não consegui baixar o vídeo legendado (HTTP ${resp.status})`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const path = `${userId}/${Date.now()}-legendado.mp4`
  const { data, error } = await supabaseAdmin.storage
    .from('videos')
    .upload(path, buffer, { contentType: 'video/mp4', upsert: false })
  if (error) throw new Error(`Upload no Supabase falhou: ${error.message}`)
  const { data: urlData } = supabaseAdmin.storage.from('videos').getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const preset = typeof body.preset === 'string' ? body.preset : 'glass'

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })
  if (!conteudo) return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  if (!conteudo.videoUrl) {
    return NextResponse.json({ error: 'Este conteúdo não tem vídeo. Gere ou envie o vídeo primeiro.' }, { status: 400 })
  }

  // Texto da legenda: prioriza narração (mais longa), depois textoTela, depois chamadaAcao
  const texto =
    (conteudo.narracao?.trim()) ||
    (conteudo.textoTela?.trim()) ||
    (conteudo.chamadaAcao?.trim()) ||
    ''

  if (!texto) {
    return NextResponse.json(
      { error: 'O conteúdo não tem texto para usar como legenda (narração, textoTela ou chamadaAcao).' },
      { status: 400 }
    )
  }

  const duracao = conteudo.duracao || 10
  const srt = montarSrt(texto, duracao)

  try {
    const { statusUrl, resultUrl } = await adicionarLegendaVideo(
      {
        videoUrl: conteudo.videoUrl,
        srtContent: srt,
        preset,
      },
      conteudo.workspaceId
    )

    // Aguarda o processamento (~30-50s para vídeos curtos)
    let status = 'IN_PROGRESS'
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const s = await consultarStatusVideo(statusUrl)
      status = s.status
      if (status === 'COMPLETED' || status === 'FAILED') break
    }

    if (status === 'FAILED') {
      return NextResponse.json({ error: 'veed/subtitles falhou ao processar o vídeo' }, { status: 502 })
    }
    if (status !== 'COMPLETED') {
      return NextResponse.json(
        { ok: false, processando: true, mensagem: 'A legenda ainda está sendo gerada. Tente novamente em 30s.' }
      )
    }

    const { videoUrl } = await obterResultadoLegenda(resultUrl)
    const urlFinal = await baixarUploadParaSupabase(videoUrl, session.user.id)

    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoUrl: urlFinal },
    })

    return NextResponse.json({ ok: true, videoUrl: urlFinal })
  } catch (e) {
    if (e instanceof BloqueadoPorPoliticaDeCusto) {
      // SEM EQUIVALENTE GRATUITO. Nenhuma função local queima legenda em um
      // vídeo JÁ EXISTENTE — `renderer-ffmpeg` só monta vídeo a partir de
      // imagem. Em vez de inventar uma capacidade que não existe, o SRT
      // gerado (que é local e gratuito) volta para quem chamou, e a
      // pendência fica registrada na Fila de Automação.
      return NextResponse.json(
        {
          ok: false,
          bloqueadoPorCusto: true,
          erro: e.message,
          srt,
          pendenciaDeAutomacao: 'fal.ai:adicionar-legenda',
          mensagem:
            'A legendagem paga está bloqueada pela política de custo zero e ainda não há equivalente local. O arquivo SRT foi gerado sem custo e pode ser usado no editor.',
        },
        { status: 402 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Falha ao adicionar legendas'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
