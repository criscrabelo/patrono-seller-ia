import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publicarReelInstagram, montarLegenda } from '@/lib/instagram'

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
  const devidos = await prisma.conteudo.findMany({
    where: { status: 'agendado', dataAgendamento: { lte: agora } },
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

    // Com vídeo: precisa do Instagram conectado para publicar o Reels.
    const integracao = await prisma.integracao.findUnique({
      where: { userId_plataforma: { userId: c.userId, plataforma: 'instagram' } },
    })
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
        legenda: montarLegenda(c.legendaInstagram, c.hashtags),
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
    executadoEm: agora.toISOString(),
  })
}
