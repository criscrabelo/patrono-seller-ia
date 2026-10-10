import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const SHOPEE_API = 'https://partner.shopeemobile.com/api/v2'

function sign(partnerId: number, partnerKey: string, path: string, timestamp: number, accessToken: string, shopId: number) {
  const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`
  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex')
}

function gerarSlug(nome: string, plataforma: string) {
  const base = nome.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').substring(0, 30)
  const seq = Math.floor(Math.random() * 900 + 100)
  return `${base}-${plataforma}-${seq}`
}

// POST – gera links de afiliado para todos os produtos Shopee cadastrados
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { acao } = body // 'gerar_links' | 'sincronizar_produtos'

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_plataforma: { workspaceId: session.user.workspaceId, plataforma: 'shopee' } },
  })

  if (!integracao || integracao.status !== 'conectado') {
    return NextResponse.json({ error: 'Shopee não conectada' }, { status: 400 })
  }

  const extra = integracao.extraData as Record<string, string> | null

  if (acao === 'gerar_links') {
    // Gera links rastreáveis (/api/l/slug, no domínio configurado) para todos os produtos Shopee
    const produtos = await prisma.produto.findMany({
      where: {
        workspaceId: session.user.workspaceId,
        status: 'ativo',
        linkProduto: { not: null },
      },
    })

    const shopeeProds = produtos.filter(p =>
      p.linkProduto?.includes('shopee.com.br') || p.linkProduto?.includes('shope.ee')
    )

    let criados = 0
    let jaExistiam = 0

    for (const prod of shopeeProds) {
      // Verifica se já existe link Shopee para este produto
      const existing = await prisma.linkDinamico.findFirst({
        where: { workspaceId: session.user.workspaceId, produtoId: prod.id, plataforma: 'shopee' },
      })

      if (existing) { jaExistiam++; continue }

      // Monta URL com parâmetros de afiliado se houver subId
      let urlDestino = prod.linkProduto!
      if (extra?.subId) {
        const sep = urlDestino.includes('?') ? '&' : '?'
        urlDestino = `${urlDestino}${sep}smtt=0.0.9&sub_id1=${extra.subId}`
      }

      await prisma.linkDinamico.create({
        data: {
          userId: session.user.id,
          workspaceId: session.user.workspaceId,
          produtoId: prod.id,
          slug: gerarSlug(prod.nome, 'shopee'),
          plataforma: 'shopee',
          urlDestino,
          tipo: 'afiliado',
          comissao: 10,
          precoAtual: prod.preco,
        },
      })
      criados++
    }

    return NextResponse.json({
      criados,
      jaExistiam,
      total: shopeeProds.length,
    })
  }

  if (acao === 'sincronizar_produtos') {
    // Sincroniza catálogo via Shopee Open Platform (modo vendedor)
    const { partnerId, subId: _s, modo } = extra ?? {}
    if (modo !== 'vendedor' || !partnerId || !integracao.accessToken || !integracao.accountId) {
      return NextResponse.json({ error: 'Credenciais de vendedor não configuradas' }, { status: 400 })
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const path = '/product/get_item_list'
      const sig = sign(
        Number(partnerId),
        String(integracao.accessToken), // partnerKey está no accessToken por simplificação
        path,
        timestamp,
        integracao.accessToken,
        Number(integracao.accountId)
      )

      const url = `${SHOPEE_API}${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${integracao.accessToken}&shop_id=${integracao.accountId}&sign=${sig}&page_size=100&item_status=NORMAL`
      const res = await fetch(url)
      const data = await res.json()

      if (data.error) {
        return NextResponse.json({ error: data.message }, { status: 400 })
      }

      const items: { item_id: number; item_name: string; item_sku: string }[] = data.response?.item ?? []

      return NextResponse.json({ sincronizados: items.length, items: items.slice(0, 10) })
    } catch (e) {
      return NextResponse.json({ error: 'Falha ao buscar produtos Shopee' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
