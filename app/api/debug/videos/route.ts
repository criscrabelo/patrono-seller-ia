import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Diagnóstico — lista todos os conteúdos e o estado do vídeo de cada um.
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const conteudos = await prisma.conteudo.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { produto: { select: { nome: true } } },
  })

  return NextResponse.json({
    totalConteudos: conteudos.length,
    comVideo: conteudos.filter((c) => c.videoUrl).length,
    conteudos: conteudos.map((c) => ({
      produto: c.produto?.nome ?? '(sem produto)',
      status: c.status,
      temVideoUrl: !!c.videoUrl,
      videoUrlInicio: c.videoUrl ? c.videoUrl.slice(0, 70) : null,
      videoRequestId: c.videoRequestId,
      videoErro: c.videoErro,
      publicado: !!c.publicacaoExternaId,
    })),
  })
}
