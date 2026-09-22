import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicarReelInstagram, montarLegenda, renovarTokenInstagram } from '@/lib/instagram'
import { capturarSnapshotDePublicacao } from '@/lib/ml-captura-publicacao'
import {
  prepararTentativaDePublicacao,
  confirmarDistribuicao,
  registrarFalhaDaTentativa,
} from '@/lib/publicacao-fluxo'

// Endpoint chamado pela Vercel Cron para publicar automaticamente os
// conteúdos cuja data de agendamento já chegou.
// - Sem vídeo (ou sem Instagram conectado): apenas marca como "publicado".
// - Com vídeo + Instagram conectado: publica o Reels de verdade.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Segurança: este endpoint não tem sessão de usuária (quem chama é a
  // Vercel Cron, não uma pessoa logada) — isso NÃO significa que pode
  // aceitar chamadas públicas sem autenticação própria. Exige sempre o
  // segredo, tanto faz se CRON_SECRET está configurado ou não: se não
  // estiver, a rota se recusa a rodar em vez de ficar aberta por padrão.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/publicar] CRON_SECRET não configurado — recusando executar.')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()

  // ── Renovação automática de tokens do Instagram prestes a expirar ──
  const DIAS_AVISO = 15
  const limiteRenovacao = new Date(agora.getTime() + DIAS_AVISO * 24 * 60 * 60 * 1000)
  const tokensParaRenovar = await prisma.integracao.findMany({
    where: {
      plataforma: 'instagram',
      status: 'conectado',
      tokenExpiry: { lte: limiteRenovacao },
    },
  })

  let tokensRenovados = 0
  let tokensFalha = 0
  for (const integ of tokensParaRenovar) {
    const extra = (integ.extraData ?? {}) as Record<string, string>
    if (!extra.appId || !extra.appSecret || !integ.accessToken) continue
    try {
      const { accessToken: novoToken, expiresIn } = await renovarTokenInstagram({
        accessToken: integ.accessToken,
        appId: extra.appId,
        appSecret: extra.appSecret,
      })
      await prisma.integracao.update({
        where: { id: integ.id },
        data: {
          accessToken: novoToken,
          tokenExpiry: new Date(agora.getTime() + expiresIn * 1000),
          updatedAt: agora,
        },
      })
      tokensRenovados++
    } catch {
      tokensFalha++
    }
  }

  const devidos = await prisma.conteudo.findMany({
    where: { status: 'agendado', dataAgendamento: { lte: agora } },
    include: { produto: { select: { linkProduto: true } } },
  })

  let publicadosApp = 0
  let publicadosInstagram = 0
  let falhas = 0
  // GATILHO A (P0.2 Bloco 4.1): a amostra de ML nasce quando um CANAL
  // confirma a distribuição — nunca quando o conteúdo é marcado como
  // publicado só dentro do app. `capturarSnapshotDePublicacao` recusa
  // sozinha quando não há identificador externo, então os dois caminhos
  // internos abaixo (sem vídeo, sem Instagram conectado) não produzem
  // amostra. Nunca lança: a publicação é o fato principal.
  let amostrasCapturadas = 0
  const capturar = async (workspaceId: string, contentId: string) => {
    const r = await capturarSnapshotDePublicacao({ workspaceId, contentId, agora })
    if (r.capturado) amostrasCapturadas++
  }

  // P1.0 Etapa 2.c: o caminho agendado usa a MESMA autoridade central do
  // "publicar agora". A chave da tentativa deriva do agendamento, entao uma
  // reexecucao do cron reencontra a mesma Publicacao e o mesmo link.
  let publicacoesSemRastreamento = 0

  for (const c of devidos) {
    // Sem vídeo: publicação apenas dentro do app.
    if (!c.videoUrl) {
      // PUBLICAÇÃO INTERNA: sem vídeo não há nada a distribuir. Nenhuma
      // amostra de ML nasce daqui.
      await prisma.conteudo.update({
        where: { id: c.id },
        data: { status: 'publicado', dataPublicacao: agora },
      })
      publicadosApp++
      continue
    }

    // Com vídeo: precisa do Instagram conectado para publicar o Reels.
    const integracao = await prisma.integracao.findUnique({
      where: { workspaceId_plataforma: { workspaceId: c.workspaceId, plataforma: 'instagram' } },
    })
    if (
      !integracao ||
      integracao.status !== 'conectado' ||
      !integracao.accessToken ||
      !integracao.accountId
    ) {
      // PUBLICAÇÃO INTERNA: sem canal conectado o conteúdo não circulou.
      // Nenhuma amostra de ML nasce daqui.
      await prisma.conteudo.update({
        where: { id: c.id },
        data: { status: 'publicado', dataPublicacao: agora },
      })
      publicadosApp++
      continue
    }

    const tentativa = await prepararTentativaDePublicacao({
      workspaceId: c.workspaceId,
      contentId: c.id,
      canal: 'instagram',
      urlDiretaDoProduto: c.produto?.linkProduto ?? null,
      dataAgendamento: c.dataAgendamento,
    })
    if (!tentativa.rastreada) publicacoesSemRastreamento++

    try {
      const mediaId = await publicarReelInstagram({
        accessToken: integracao.accessToken,
        igUserId: integracao.accountId,
        videoUrl: c.videoUrl,
        legenda: montarLegenda(c.legendaInstagram, c.hashtags, c.chamadaAcao, tentativa.urlParaDivulgar),
      })
      await prisma.conteudo.update({
        where: { id: c.id },
        data: {
          status: 'publicado',
          dataPublicacao: agora,
          publicacaoExternaId: mediaId,
          erroPublicacao: null,
        },
      })
      if (tentativa.publicacao) {
        await confirmarDistribuicao({
          workspaceId: c.workspaceId,
          publicacaoId: tentativa.publicacao.id,
          publicacaoExternaId: mediaId,
          distribuidaEm: agora,
        })
      }
      // DISTRIBUIÇÃO REAL: o canal devolveu `mediaId`. É aqui — e só aqui,
      // neste cron — que a amostra de produção nasce.
      await capturar(c.workspaceId, c.id)
      publicadosInstagram++
    } catch (e) {
      // Falha REAL do provider. O conteudo continua "agendado" e a proxima
      // execucao reusa a MESMA chave da tentativa — mesma Publicacao, que
      // volta de FALHOU para DISTRIBUINDO.
      if (tentativa.publicacao) {
        await registrarFalhaDaTentativa({
          workspaceId: c.workspaceId,
          publicacaoId: tentativa.publicacao.id,
        })
      }
      await prisma.conteudo.update({
        where: { id: c.id },
        data: { erroPublicacao: e instanceof Error ? e.message : 'Falha ao publicar' },
      })
      falhas++
    }
  }

  return NextResponse.json({
    ok: true,
    publicadosApp,
    publicadosInstagram,
    falhas,
    amostrasCapturadas,
    publicacoesSemRastreamento,
    tokensRenovados,
    tokensFalha,
    executadoEm: agora.toISOString(),
  })
}
