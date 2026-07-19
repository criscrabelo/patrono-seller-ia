import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContaAtivaId } from '@/lib/conta'
import { submeterGeracaoVideo } from '@/lib/falai'

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
  const duracaoSolicitada = Number(body.duracao) || 5
  const DURACOES_VALIDAS = [5, 10, 15, 30]
  if (!DURACOES_VALIDAS.includes(duracaoSolicitada)) {
    return NextResponse.json(
      { error: 'Duração inválida (use 5, 10, 15 ou 30 segundos)' },
      { status: 400 }
    )
  }

  const contaId = await getContaAtivaId(session.user.id)
  if (!contaId) return NextResponse.json({ error: 'Nenhuma marca configurada' }, { status: 400 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, contaId },
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

  const { duracaoClipe, numClipes } = planoDeClipes(duracaoSolicitada)

  try {
    // Submete todos os clipes em paralelo, cada um usando uma imagem diferente
    // (cicla pelas imagens disponíveis se houver menos imagens que clipes).
    const submissoes = await Promise.all(
      Array.from({ length: numClipes }, (_, i) =>
        submeterGeracaoVideo({
          imageUrl: imagens[i % imagens.length],
          prompt,
          duracaoSegundos: duracaoClipe,
        })
      )
    )

    const estado = {
      fase: 'gerando_clipes' as const,
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
