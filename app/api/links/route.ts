import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { resumoPorLink } from '@/lib/vendas-comissoes'
import { urlRastreadaParaExibir } from '@/lib/link-de-publicacao'

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

  const where: Record<string, string> = { workspaceId: session.user.workspaceId }
  if (produtoId) where.produtoId = produtoId

  const links = await prisma.linkDinamico.findMany({
    where,
    include: { produto: { select: { nome: true, preco: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Rodada 4 — `conversoes`/`receitaTotal` gravados no LinkDinamico são
  // DEPRECATED_LEGACY (nunca mais incrementados por operações novas). A
  // tela "Meus Links" continua recebendo esses mesmos campos na resposta,
  // mas agora calculados a partir de Sale (fonte única) — nunca somando as
  // duas fontes.
  const porLink = await resumoPorLink(session.user.workspaceId)
  const linksComDadosReais = links.map((link) => {
    // P2.5: a URL que a tela mostra e copia sai daqui, da MESMA função
    // central da publicação. Em produção nunca é localhost; sem base
    // configurada, `urlPublica` é null e o motivo vai junto.
    const publica = urlRastreadaParaExibir(link.slug)
    return {
      ...link,
      conversoes: porLink.get(link.id)?.conversoes ?? 0,
      receitaTotal: porLink.get(link.id)?.receitaTotal ?? 0,
      urlPublica: publica.url,
      urlPublicaLocal: publica.local,
      motivoSemUrlPublica: publica.motivo,
    }
  })

  return NextResponse.json(linksComDadosReais)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { produtoId, urlDestino, tipo, comissao, plataformas: plats } = body

  const produto = await prisma.produto.findFirst({
    where: { id: produtoId, workspaceId: session.user.workspaceId },
  })
  if (!produto) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

  const platformList: string[] = plats ?? PLATAFORMAS

  const links = await Promise.all(
    platformList.map(async (plataforma: string) => {
      const slug = gerarSlug(produto.nome, plataforma)
      return prisma.linkDinamico.create({
        data: {
          userId: session.user.id,
          workspaceId: session.user.workspaceId,
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

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'link.criado',
    entityType: 'LinkDinamico',
    entityId: links.map((l) => l.id).join(','),
    metadata: { produtoId, quantidade: links.length },
  })

  return NextResponse.json(links)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, urlDestino, comissao, ativo } = body

  await prisma.linkDinamico.updateMany({
    where: { id, workspaceId: session.user.workspaceId },
    data: {
      ...(urlDestino !== undefined && { urlDestino }),
      ...(comissao !== undefined && { comissao: parseFloat(comissao) }),
      ...(ativo !== undefined && { ativo }),
      ultimaAtualizacao: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
