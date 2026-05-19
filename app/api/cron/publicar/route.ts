import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint chamado pela Vercel Cron para publicar automaticamente os
// conteúdos cuja data de agendamento já chegou.
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

  const result = await prisma.conteudo.updateMany({
    where: {
      status: 'agendado',
      dataAgendamento: { lte: agora },
    },
    data: {
      status: 'publicado',
      dataPublicacao: agora,
    },
  })

  return NextResponse.json({
    ok: true,
    publicados: result.count,
    executadoEm: agora.toISOString(),
  })
}
