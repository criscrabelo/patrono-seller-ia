import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarResultado } from '@/lib/vendas-comissoes'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const valor = parseFloat(body.valor)
  if (!valor || valor <= 0) {
    return NextResponse.json({ error: 'Informe um valor de venda válido' }, { status: 400 })
  }
  // Idempotência persistente (Rodada 4): a tela gera esta chave uma vez por
  // tentativa de envio e reenvia a mesma em cada retry — ver
  // lib/vendas-comissoes.ts `registrarResultado()`.
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null

  const link = await prisma.linkDinamico.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })
  if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })

  // Loja própria: o valor da venda inteiro é a receita do vendedor (sem custo cadastrado).
  // Afiliado / TikTok Shop: a receita é a comissão sobre o valor vendido.
  const receitaGanha = link.tipo === 'loja-propria'
    ? valor
    : valor * ((link.comissao ?? 0) / 100)

  // Sale/Commission são a fonte única (Rodada 3/4) — o contador legado em
  // LinkDinamico (conversoes/receitaTotal, DEPRECATED_LEGACY) NÃO é mais
  // incrementado aqui. A tela "Meus Links" já lê o resumo calculado a
  // partir de Sale (GET /api/links, via lib/vendas-comissoes.ts
  // `resumoPorLink`), então nada muda visualmente para quem usa a tela.
  const resultado = await registrarResultado({
    workspaceId: session.user.workspaceId,
    actorUserId: session.user.id,
    // PROVENIÊNCIA (P0.2 Bloco 1): rota autenticada, venda registrada pela
    // proprietária a partir de um link real do workspace dela.
    dataOrigin: 'REAL_OPERATION',
    productId: link.produtoId,
    linkId: link.id,
    amount: valor,
    status: 'CONFIRMED',
    expectedCommission: receitaGanha,
    idempotencyKey,
  })

  return NextResponse.json({
    link,
    sale: resultado.sale,
    commission: resultado.commission,
    duplicado: resultado.duplicado,
  })
}
