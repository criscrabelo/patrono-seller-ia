import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { avaliarRastreamentoDosConteudos } from '@/lib/rastreamento-da-publicacao'

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

  // Estado de rastreamento por publicacao (P1.0 Etapa 2.a — microcorrecao).
  // Uma publicacao que caiu no fallback saiu com o link direto do produto:
  // o clique dela nunca passa pelo redirect e por isso nao e medido. Isso
  // precisa aparecer na tela, senao a unica forma de descobrir seria olhar
  // log de servidor. Uma consulta so para a listagem inteira.
  const rastreamento = await avaliarRastreamentoDosConteudos(session.user.workspaceId, conteudos)

  return NextResponse.json(
    conteudos.map((c) => ({
      ...c,
      rastreamento: rastreamento.get(c.id) ?? null,
    }))
  )
}
