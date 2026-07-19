import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicarReelInstagram, montarLegenda, renovarTokenInstagram } from '@/lib/instagram'

// Endpoint chamado pela Vercel Cron para publicar automaticamente os
// conteúdos cuja data de agendamento já chegou.
// - Sem vídeo (ou sem Instagram conectado): apenas marca como "publicado".
// - Com vídeo + Instagram conectado: publica o Reels de verdade.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Segurança: se CRON_SECRET estiver definido, exige o header enviado pela Vercel.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
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

  for (const c of devidos) {
    // Sem vídeo: publicação apenas dentro do app.
    if (!c.videoUrl) {
      await prisma.conteudo.update({
        where: { id: c.id },
        data: { status: 'publicado', dataPublicacao: agora },
      })
      publicadosApp++
      continue
    }

    // Com vídeo: precisa do Instagram conectado (da MESMA conta/marca do
    // conteúdo) para publicar o Reels. Se o conteúdo ainda não tem contaId
    // (backfill da Etapa 1 não rodou nesta base), não há como saber qual
    // integração usar — trata como "não conectado" e publica só no app,
    // em vez de arriscar pegar a integração errada de outra conta.
    const integracao = c.contaId
      ? await prisma.integracao.findUnique({
          where: { contaId_plataforma: { contaId: c.contaId, plataforma: 'instagram' } },
        })
      : null
    if (
      !integracao ||
      integracao.status !== 'conectado' ||
      !integracao.accessToken ||
      !integracao.accountId
    ) {
      await prisma.conteudo.update({
        where: { id: c.id },
        data: { status: 'publicado', dataPublicacao: agora },
      })
      publicadosApp++
      continue
    }

    try {
      const mediaId = await publicarReelInstagram({
        accessToken: integracao.accessToken,
        igUserId: integracao.accountId,
        videoUrl: c.videoUrl,
        legenda: montarLegenda(c.legendaInstagram, c.hashtags, c.chamadaAcao, c.produto?.linkProduto),
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
      publicadosInstagram++
    } catch (e) {
      // Mantém como "agendado" para tentar de novo na próxima execução.
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
    tokensRenovados,
    tokensFalha,
    executadoEm: agora.toISOString(),
  })
}
