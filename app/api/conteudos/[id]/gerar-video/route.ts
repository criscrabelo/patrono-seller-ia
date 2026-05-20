import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { submeterGeracaoVideo } from '@/lib/falai'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id, userId: session.user.id },
    include: { produto: { select: { imagens: true, nome: true } } },
  })
  if (!conteudo) {
    return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
  }

  const imagemUrl = conteudo.produto.imagens?.[0]
  if (!imagemUrl) {
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

  try {
    const { requestId, statusUrl, resultUrl } = await submeterGeracaoVideo({
      imageUrl: imagemUrl,
      prompt,
      duracaoSegundos: 5,
    })

    // Guarda os 3 valores num JSON em videoRequestId (evita adicionar colunas)
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: {
        videoRequestId: JSON.stringify({ requestId, statusUrl, resultUrl }),
        videoErro: null,
      },
    })

    return NextResponse.json({ ok: true, requestId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao iniciar geração de vídeo'
    await prisma.conteudo.update({
      where: { id: conteudo.id },
      data: { videoErro: msg },
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
