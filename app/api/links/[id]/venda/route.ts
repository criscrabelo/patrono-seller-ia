import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'

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

  // Contador do link (fonte hoje do Dashboard/Lucro e Escala — mantido como
  // está para não alterar o que a tela já mostra).
  const atualizado = await prisma.linkDinamico.update({
    where: { id },
    data: {
      conversoes: { increment: 1 },
      receitaTotal: { increment: receitaGanha },
      ultimaAtualizacao: new Date(),
    },
  })

  // Registro estruturado da venda e da comissão (venda ≠ comissão: uma
  // venda registrada aqui começa como CONFIRMED — é um valor que a própria
  // usuária está informando que recebeu — mas a comissão sobre ela começa
  // como EXPECTED, nunca como recebida automaticamente). Este é o modelo
  // que a tela "Vendas e Comissões" vai passar a usar; o contador acima
  // continua alimentando o Dashboard atual enquanto isso não migra.
  const sale = await prisma.sale.create({
    data: {
      workspaceId: session.user.workspaceId,
      productId: link.produtoId,
      linkId: link.id,
      amount: valor,
      status: 'CONFIRMED',
      source: 'manual',
    },
  })

  const commission = await prisma.commission.create({
    data: {
      workspaceId: session.user.workspaceId,
      saleId: sale.id,
      productId: link.produtoId,
      expectedAmount: receitaGanha,
      status: 'EXPECTED',
      expectedAt: new Date(),
    },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'venda.registrada',
    entityType: 'Sale',
    entityId: sale.id,
    metadata: { linkId: link.id, valor, comissaoPrevista: receitaGanha },
  })

  return NextResponse.json({ link: atualizado, sale, commission })
}
