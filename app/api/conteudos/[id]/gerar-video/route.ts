import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { submeterGeracaoVideo, MOTORES_VIDEO, type MotorVideo } from '@/lib/falai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Configuração de durações suportadas. Cada duração mapeia para um
// conjunto de clipes (Kling v3 Pro maxa em 15s por clipe).
function planoDeClipes(duracaoTotal: number): { duracaoClipe: number; numClipes: number } {
  if (duracaoTotal === 30) return { duracaoClipe: 15, numClipes: 2 }
  // 5, 10 ou 15s — clipe único
  return { duracaoClipe: duracaoTotal, numClipes: 1 }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const motor: MotorVideo = body.motor === 'veo' || body.motor === 'luma' ? body.motor : 'kling'
  const duracaoSolicitada = Number(body.duracao) || 5

  // Cada motor aceita durações diferentes; Veo é fixo (ignora o valor).
  const DURACOES_VALIDAS_POR_MOTOR: Record<MotorVideo, number[] | null> = {
    kling: [5, 10, 15, 30],
    veo: null,
    luma: [5, 9],
  }
  const duracoesValidas = DURACOES_VALIDAS_POR_MOTOR[motor]
  if (duracoesValidas && !duracoesValidas.includes(duracaoSolicitada)) {
    return NextResponse.json(
      { error: `Duração inválida para ${MOTORES_VIDEO[motor].label} (use ${duracoesValidas.join(', ')} segundos)` },
      { status: 400 }
    )
  }

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, userId: session.user.id },
    include: { produto: { select: { imagens: true, nome: true } } },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }

  const imagens = conteudo.produto.imagens ?? []
  if (imagens.length === 0) {
    return NextResponse.json(
      { error: 'O produto não tem imagens. Adicione uma imagem ao produto antes de gerar o vídeo.' },
      { status: 400 }
    )
  }

  const prompt = (conteudo.promptVideoIA || conteudo.promptCurto || '').trim()
  if (!prompt) {
    return NextResponse.json(
      { error: 'O conteúdo não tem prompt de vídeo. Gere o conteúdo novamente.' },
      { status: 400 }
    )
  }

  // Veo gera um clipe único (~8s com áudio); Kling pode compor vários clipes.
  const { duracaoClipe, numClipes } = MOTORES_VIDEO[motor].clipeUnico
    ? { duracaoClipe: duracaoSolicitada, numClipes: 1 }
    : planoDeClipes(duracaoSolicitada)

  try {
    // Submete todos os clipes em paralelo, cada um usando uma imagem diferente
    // (cicla pelas imagens disponíveis se houver menos imagens que clipes).
    const submissoes = await Promise.all(
      Array.from({ length: numClipes }, (_, i) =>
        submeterGeracaoVideo({
          imageUrl: imagens[i % imagens.length],
          prompt,
          duracaoSegundos: duracaoClipe,
        }, motor)
      )
    )

    const estado = {
      fase: 'gerando_clipes' as const,
      motor,
      duracaoTotal: duracaoSolicitada,
      clipes: submissoes.map((s) => ({
        requestId: s.requestId,
        statusUrl: s.statusUrl,
        resultUrl: s.resultUrl,
        videoUrl: null as string | null,
      })),
      compose: null as null | { requestId: string; statusUrl: string; resultUrl: string },
    }

    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: {
        videoRequestId: JSON.stringify(estado),
        videoErro: null,
      },
    })

    return NextResponse.json({ ok: true, numClipes, duracaoTotal: duracaoSolicitada })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao iniciar geração de vídeo'
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoErro: msg },
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
