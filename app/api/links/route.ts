import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PLATAFORMAS = [
  'tiktok','instagram','youtube','facebook','pinterest','linkedin',
  'blog','email','whatsapp','telegram','reddit','discord',
  'patreon','gumroad','amazon','mercadolivre','shopee','hotmart',
]

function gerarSlug(nomeProduto: string, plataforma: string): string {
  const base = nomeProduto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30)
  const seq = Math.floor(Math.random() * 900 + 100)
  return `${base}-${plataforma}-${seq}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const produtoId = searchParams.get('produtoId')

  const where: Record<string, string> = { userId: session.user.id }
  if (produtoId) where.produtoId = produtoId

  const links = await prisma.linkDinamico.findMany({
    where,
    include: { produto: { select: { nome: true, preco: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(links)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { produtoId, urlDestino, tipo, comissao, plataformas: plats } = body

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, userId: session.user.id },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const platformList: string[] = plats ?? PLATAFORMAS

  const links = await Promise.all(
    platformList.map(async (plataforma: string) => {
      const slug = gerarSlug(produto.nome, plataforma)
      return prisma.linkDinamico.create({
        data: {
          userId: session.user.id,
          produtoId,
          slug,
          plataforma,
          urlDestino,
          tipo: tipo ?? 'afiliado',
          comissao: comissao ? parseFloat(comissao) : null,
          precoAtual: produto.preco,
        },
      })
    })
  )

  return NextResponse.json(links)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, urlDestino, comissao, ativo } = body

  await prisma.linkDinamico.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(urlDestino !== undefined && { urlDestino }),
      ...(comissao !== undefined && { comissao: parseFloat(comissao) }),
      ...(ativo !== undefined && { ativo }),
      ultimaAtualizacao: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
