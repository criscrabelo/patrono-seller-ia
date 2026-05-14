import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const link = await prisma.linkDinamico.findUnique({
    where: { slug },
  })

  if (!link || !link.ativo) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Registrar clique em background
  prisma.linkDinamico.update({
    where: { id: link.id },
    data: { cliques: { increment: 1 } },
  }).then(() =>
    prisma.eventoLink.create({
      data: {
        linkId: link.id,
        tipo: 'clique',
        plataforma: link.plataforma,
        referer: req.headers.get('referer') ?? undefined,
      },
    })
  ).catch(() => {})

  return NextResponse.redirect(link.urlDestino)
}
