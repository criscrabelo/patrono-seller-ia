import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Publicação automática: ao abrir o app, conteúdos agendados SEM vídeo
  // cuja data já passou são marcados como publicados (complementa o cron).
  // Conteúdos com vídeo são publicados no Instagram pelo cron ou pelo botão
  // "Publicar agora" — não aqui, para não travar a listagem com chamadas à API.
  // NENHUMA amostra de ML nasce aqui, e isso é deliberado.
  //
  // Este caminho marca como "publicado" um conteúdo agendado SEM vídeo, ao
  // abrir a listagem. É publicação INTERNA: nada saiu do Patrono, nenhum
  // canal devolveu identificador, ninguém viu o conteúdo. Capturar amostra
  // daqui faria com que, trinta dias depois, o cron da janela a rotulasse
  // como "não converteu" — ensinando ao modelo uma falha de um criativo que
  // nunca chegou a existir para o público.
  //
  // A amostra nasce quando um canal confirma a distribuição — ver
  // `avaliarDistribuicaoReal()` em lib/ml-captura-publicacao.ts.
  await prisma.conteudo.updateMany({
    where: {
      workspaceId: session.user.workspaceId,
      status: 'agendado',
      dataAgendamento: { lte: new Date() },
      videoUrl: null,
    },
    data: { status: 'publicado', dataPublicacao: new Date() },
  })

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
