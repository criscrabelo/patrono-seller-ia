import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { capturarSnapshotsDePublicacao } from '@/lib/ml-captura-publicacao'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Publicação automática: ao abrir o app, conteúdos agendados SEM vídeo
  // cuja data já passou são marcados como publicados (complementa o cron).
  // Conteúdos com vídeo são publicados no Instagram pelo cron ou pelo botão
  // "Publicar agora" — não aqui, para não travar a listagem com chamadas à API.
  // Os ids são coletados ANTES do update porque `updateMany` não os
  // devolve — e sem eles não há como capturar a amostra de ML de cada
  // conteúdo publicado (GATILHO A do P0.2 Bloco 4.1).
  const aPublicar = await prisma.conteudo.findMany({
    where: {
      workspaceId: session.user.workspaceId,
      status: 'agendado',
      dataAgendamento: { lte: new Date() },
      videoUrl: null,
    },
    select: { id: true },
  })
  if (aPublicar.length > 0) {
    await prisma.conteudo.updateMany({
      where: { id: { in: aPublicar.map((c) => c.id) } },
      data: { status: 'publicado', dataPublicacao: new Date() },
    })
    // Captura prospectiva: as features são observadas AGORA, no instante da
    // publicação, e nunca reconstruídas depois a partir do conteúdo atual.
    // `capturarSnapshotsDePublicacao` nunca lança — listar conteúdo não pode
    // falhar porque o ML não conseguiu observar.
    await capturarSnapshotsDePublicacao(
      session.user.workspaceId,
      aPublicar.map((c) => c.id)
    )
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const produtoId = searchParams.get('produtoId')
  const redeSocial = searchParams.get('redeSocial')
  const countOnly = searchParams.get('count') === 'true'

  const where = {
    workspaceId: session.user.workspaceId,
    ...(status && { status }),
    ...(produtoId && { produtoId }),
    ...(redeSocial && { redeSocial }),
  }

  if (countOnly) {
    const count = await prisma.conteudo.count({ where })
    return NextResponse.json({ count })
  }

  const conteudos = await prisma.conteudo.findMany({
    where,
    include: { produto: { select: { nome: true, imagens: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(conteudos)
}
