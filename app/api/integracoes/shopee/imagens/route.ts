import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CDN = 'https://down-br.img.susercontent.com/file/'

// Extrai shopId e itemId da URL Shopee
function parsearUrl(url: string): { shopId: string; itemId: string } | null {
  const match = url.match(/i\.(\d+)\.(\d+)/)
  if (!match) return null
  return { shopId: match[1], itemId: match[2] }
}

// Busca imagens via API pública da Shopee (JSON, sem scraping)
async function buscarImagensShopee(shopId: string, itemId: string): Promise<string[]> {
  try {
    const url = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': 'https://shopee.com.br/',
        'Accept': 'application/json',
        'x-api-source': 'pc',
        'af-ac-enc-dat': 'null',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return []
    const data = await res.json()
    const item = data?.data?.item
    if (!item) return []

    const imagens: string[] = []

    // Imagem principal
    if (item.image) imagens.push(CDN + item.image)

    // Imagens do carrossel
    if (Array.isArray(item.images)) {
      for (const img of item.images) {
        const url = CDN + img
        if (!imagens.includes(url)) imagens.push(url)
        if (imagens.length >= 6) break
      }
    }

    return imagens
  } catch {
    return []
  }
}

// POST – busca e salva imagens de todos os produtos Shopee
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { produtoId } = body

  const where = produtoId
    ? { id: produtoId, userId: session.user.id }
    : { userId: session.user.id, linkProduto: { contains: 'shopee' } }

  const produtos = await prisma.produto.findMany({
    where,
    select: { id: true, nome: true, linkProduto: true, imagens: true },
  })

  const resultados = []

  for (const prod of produtos) {
    if (!prod.linkProduto) {
      resultados.push({ id: prod.id, nome: prod.nome, imagens: [], status: 'sem_link' })
      continue
    }

    if (prod.imagens.length > 0) {
      resultados.push({ id: prod.id, nome: prod.nome, imagens: prod.imagens, status: 'ja_tem' })
      continue
    }

    const ids = parsearUrl(prod.linkProduto)
    if (!ids) {
      resultados.push({ id: prod.id, nome: prod.nome, imagens: [], status: 'url_invalida' })
      continue
    }

    const imagens = await buscarImagensShopee(ids.shopId, ids.itemId)

    if (imagens.length > 0) {
      await prisma.produto.update({ where: { id: prod.id }, data: { imagens } })
      resultados.push({ id: prod.id, nome: prod.nome, imagens, status: 'ok' })
    } else {
      resultados.push({ id: prod.id, nome: prod.nome, imagens: [], status: 'erro' })
    }

    await new Promise(r => setTimeout(r, 800))
  }

  return NextResponse.json(resultados)
}
