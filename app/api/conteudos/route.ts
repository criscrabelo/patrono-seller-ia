import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const produtoId = searchParams.get('produtoId')
  const redeSocial = searchParams.get('redeSocial')
  const countOnly = searchParams.get('count') === 'true'

  const where = {
    userId: session.user.id,
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
