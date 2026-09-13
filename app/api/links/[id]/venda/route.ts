import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  const link = await prisma.linkDinamico.findFirst({
    where: { id, workspaceId: session.user.workspaceId },
  })
  if (!link) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })

  // Loja própria: o valor da venda inteiro é a receita do vendedor (sem custo cadastrado).
  // Afiliado / TikTok Shop: a receita é a comissão sobre o valor vendido.
  const receitaGanha = link.tipo === 'loja-propria'
    ? valor
    : valor * ((link.comissao ?? 0) / 100)

  // Proteção contra duplo clique: o mesmo envio do formulário não pode
  // criar duas vendas. Se já existe uma Sale idêntica (mesmo link e valor)
  // registrada nos últimos 5 segundos, devolve ela em vez de duplicar.
  const janela = new Date(Date.now() - 5000)
  const duplicata = await prisma.sale.findFirst({
    where: { workspaceId: session.user.workspaceId, linkId: link.id, amount: valor, createdAt: { gte: janela } },
    orderBy: { createdAt: 'desc' },
    include: { commissions: true },
  })
  if (duplicata) {
    return NextResponse.json({
      link,
      sale: duplicata,
      commission: duplicata.commissions[0] ?? null,
      duplicado: true,
    })
  }

  // Sale, Commission e o contador legado do link são gravados numa única
  // transação: nunca pode existir uma Commission órfã de uma Sale que
  // falhou ao ser criada, nem o contador incrementar sem a venda estruturada
  // existir (e vice-versa).
  //
  // Sale/Commission são a FONTE ÚNICA para Resultados, Vendas e Comissões e
  // "primeira comissão" a partir desta rodada. O contador em LinkDinamico
  // (conversoes/receitaTotal) continua sendo escrito aqui só por
  // compatibilidade com as telas antigas "Meus Links"/"Monetização" — nenhum
  // indicador novo volta a somá-lo.
  const { atualizado, sale, commission } = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.linkDinamico.update({
      where: { id: link.id },
      data: {
        conversoes: { increment: 1 },
        receitaTotal: { increment: receitaGanha },
        ultimaAtualizacao: new Date(),
      },
    })

    const sale = await tx.sale.create({
      data: {
        workspaceId: session.user.workspaceId,
        productId: link.produtoId,
        linkId: link.id,
        amount: valor,
        status: 'CONFIRMED',
        source: 'manual',
      },
    })

    // Venda ≠ comissão: a venda acima já nasce CONFIRMED (é um valor que a
    // própria usuária está confirmando), mas a comissão sobre ela nasce
    // EXPECTED — nunca CONFIRMED/RECEIVED automaticamente.
    const commission = await tx.commission.create({
      data: {
        workspaceId: session.user.workspaceId,
        saleId: sale.id,
        productId: link.produtoId,
        expectedAmount: receitaGanha,
        status: 'EXPECTED',
        expectedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        workspaceId: session.user.workspaceId,
        userId: session.user.id,
        action: 'venda.registrada',
        entityType: 'Sale',
        entityId: sale.id,
        metadata: { linkId: link.id, valor, comissaoPrevista: receitaGanha },
      },
    })

    return { atualizado, sale, commission }
  })

  return NextResponse.json({ link: atualizado, sale, commission, duplicado: false })
}
